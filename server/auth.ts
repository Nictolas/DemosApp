import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import connectPg from "connect-pg-simple";
import { pool } from "../db";
// Importa SupabaseService e il client supabase dalla classe di servizio
import SupabaseService, { supabase, supabaseAdmin } from "./supabase-service";

const PostgresSessionStore = connectPg(session);

declare global {
  namespace Express {
    interface User {
      id: string | number;
      email: string;
      uuid?: string;
      profile?: any;
    }
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "DEMOS_secret_key",
    resave: false,
    saveUninitialized: false,
    store: new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true,
      tableName: 'user_sessions'
    }),
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
      try {
        // Verifica credenziali direttamente con Supabase Auth
        console.log("Tentativo login con Supabase Auth per:", email);
        
        if (!supabase) {
          console.error("Client Supabase non configurato per login");
          return done(null, false, { message: "Servizio di autenticazione non disponibile" });
        }
        
        // Prima proviamo l'autenticazione con Supabase Auth
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        
        if (error || !data.user) {
          console.error("Errore login con Supabase Auth:", error);
          
          // Gestiamo specificamente l'errore di email non confermata
          if (error?.message?.includes('Email not confirmed') || error?.code === 'email_not_confirmed') {
            console.log("Tentativo di auto-conferma email durante il login per:", email);
            
            // Tentativo di auto-confermare l'email utilizzando il client admin
            if (supabaseAdmin) {
              try {
                // Prima otteniamo l'ID dell'utente dalla sua email
                const { data: adminData } = await supabaseAdmin.auth.admin.getUserByEmail(email);
                
                if (adminData?.user?.id) {
                  console.log(`Trovato ID utente: ${adminData.user.id}, tentativo di conferma email...`);
                  
                  // Conferma l'email utilizzando il client admin
                  const { error: confirmError } = await supabaseAdmin.auth.admin.updateUserById(
                    adminData.user.id,
                    { email_confirm: true }
                  );
                  
                  if (confirmError) {
                    console.error("Errore nella conferma email durante il login:", confirmError);
                    return done(null, false, { message: "Non è stato possibile confermare l'email. Contatta l'amministratore." });
                  }
                  
                  console.log("Email confermata con successo, ritento login...");
                  
                  // Riprova il login dopo la conferma
                  const { data: newData, error: newError } = await supabase.auth.signInWithPassword({
                    email,
                    password
                  });
                  
                  if (newError || !newData.user) {
                    console.error("Errore nel secondo tentativo di login:", newError);
                    return done(null, false, { message: "Email confermata, ma login fallito. Riprova." });
                  }
                  
                  // A questo punto dovremmo avere un login riuscito
                  data.user = newData.user;
                  data.session = newData.session;
                  
                  console.log("Login riuscito dopo conferma email!");
                } else {
                  console.error("Impossibile trovare l'utente per la conferma email");
                  return done(null, false, { message: "Impossibile confermare l'email. Contatta l'amministratore." });
                }
              } catch (adminError) {
                console.error("Errore durante l'uso del client admin:", adminError);
                return done(null, false, { message: "Errore interno durante la conferma dell'email." });
              }
            } else {
              console.warn("Client admin non disponibile, impossibile confermare email");
              return done(null, false, { message: "Email non confermata. Contatta l'amministratore per confermarla." });
            }
          } else {
            // Altri tipi di errori
            return done(null, false, { message: "Email o password non validi" });
          }
        }
        
        console.log("Login con Supabase Auth riuscito per:", email);
        console.log("UUID utente:", data.user.id);
        
        // Recupera i dati dell'utente dalla tabella utenti
        const userProfile = await SupabaseService.getUserByEmail(email);
        
        if (!userProfile) {
          console.log("Utente autenticato ma profilo non trovato in Supabase, creando profilo di base");
          
          // Crea un profilo di base per l'utente nella tabella utenti
          const basicProfile = {
            id: data.user.id,
            email: email,
            nome: "",
            cognome: "",
            ruolo: "Elettore"
          };
          
          await SupabaseService.saveUserData(basicProfile);
        }
        
        // Recupera di nuovo il profilo per assicurarsi di avere i dati aggiornati
        const updatedProfile = userProfile || await SupabaseService.getUserByEmail(email);
        
        // Salva l'UUID di Supabase Auth nell'oggetto utente per la sessione
        return done(null, { 
          id: data.user.id, 
          email: email,
          uuid: data.user.id, // Importante: memorizziamo l'UUID per usarlo in seguito
          profile: updatedProfile // Memorizziamo anche i dati del profilo
        });
      } catch (error) {
        console.error("Eccezione durante il login:", error);
        return done(error, false, { message: "Errore durante l'autenticazione" });
      }
    }),
  );

  passport.serializeUser((user, done) => {
    // Se è un oggetto con id e email, serialize l'intero oggetto
    if (user && typeof user === 'object' && 'id' in user && 'email' in user) {
      return done(null, JSON.stringify(user));
    }
    return done(null, user);
  });
  
  passport.deserializeUser(async (userDataStr, done) => {
    try {
      // Deserialize l'oggetto utente
      const userData = JSON.parse(String(userDataStr));
      return done(null, userData);
    } catch (error) {
      console.error("Errore deserializzando l'utente:", error);
      done(error);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      console.log("Registrazione dati utente:", JSON.stringify(req.body, null, 2));
      const { email, password, ...userDetails } = req.body;
      
      console.log("Email:", email);
      console.log("UserDetails:", JSON.stringify(userDetails, null, 2));
      
      // Registrazione esclusivamente su Supabase (nessun database locale)
      console.log("=== INIZIO REGISTRAZIONE SU SUPABASE AUTH ===");
      console.log("Dati utente per registrazione:", { email, ...userDetails });
      
      // UNICO FLUSSO: Il metodo registerUserOnSupabaseAuth esegue signUp e
      // salva DIRETTAMENTE i dati utente con saveUserOpinions
      const supabaseAuthResult = await SupabaseService.registerUserOnSupabaseAuth(email, password, userDetails);
      
      console.log("Risultato registrazione su Supabase Auth:", JSON.stringify(supabaseAuthResult, null, 2));
      
      if (!supabaseAuthResult.success) {
        console.error("Errore registrando l'utente su Supabase Auth:", supabaseAuthResult.error);
        return res.status(400).json({ error: "Errore durante la registrazione con Supabase: " + supabaseAuthResult.error });
      }
      
      console.log("=== UTENTE REGISTRATO CON SUCCESSO SU SUPABASE AUTH E SALVATO IN TABELLA UTENTI ===");
      
      // Utilizza direttamente l'UUID dall'utente Supabase Auth
      const supabaseUser = supabaseAuthResult.user;
      const uuid = supabaseUser.id;
      
      // Recupera anche il profilo appena creato da passare alla sessione
      const userProfile = await SupabaseService.getUserByEmail(email);
      
      // Crea una sessione con l'UUID di Supabase e i dati del profilo
      req.login({ 
        id: uuid,
        uuid: uuid, 
        email: email,
        profile: userProfile
      }, (err) => {
        if (err) return next(err);
        res.status(201).json({ 
          id: uuid, 
          uuid: uuid,
          email: email,
          profile: userProfile
        });
      });
    } catch (error) {
      console.error("Registration error:", error);
      return res.status(500).json({ error: "Errore durante la registrazione" });
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: Express.User | false, info: any) => {
      if (err) return next(err);
      if (!user) {
        return res.status(401).json({ error: "Email o password non validi" });
      }
      req.login(user, (err) => {
        if (err) return next(err);
        return res.status(200).json(user);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Non autenticato" });
    res.json(req.user);
  });
}