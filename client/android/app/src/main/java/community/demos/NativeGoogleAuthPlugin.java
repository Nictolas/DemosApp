package community.demos;

import android.os.CancellationSignal;

import androidx.credentials.ClearCredentialStateRequest;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.ClearCredentialException;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

import java.util.concurrent.Executor;

/**
 * Bridge minimo per Sign in with Google su Android.
 *
 * Il tap sul pulsante DEMOS usa il button flow ufficiale di Credential Manager
 * (`GetSignInWithGoogleOption`). Il token ottenuto non viene considerato
 * attendibile lato client: viene sempre inviato al backend /api/auth/oauth/google,
 * che ne verifica firma, issuer e audience prima di creare la sessione DEMOS.
 */
@CapacitorPlugin(name = "NativeGoogleAuth")
public class NativeGoogleAuthPlugin extends Plugin {

    private String publicCredentialError(GetCredentialException error) {
        String type = error.getType();
        if (type == null || type.trim().isEmpty()) {
            type = error.getClass().getSimpleName();
        }

        // Classifichiamo tramite il type pubblico di Credential Manager invece di
        // dipendere da sottoclassi AndroidX specifiche: il messaggio resta utile
        // anche se il provider restituisce una variante nuova o specifica OEM.
        if (type.contains("TYPE_USER_CANCELED") || type.contains("CANCELLATION")) {
            return "Accesso Google annullato.";
        }
        if (type.contains("PROVIDER_CONFIGURATION")) {
            return "Google Sign-In non è configurato per questa build dell'app. Codice: provider_configuration.";
        }
        if (type.contains("TYPE_NO_CREDENTIAL") || type.contains("NO_CREDENTIAL")) {
            return "Nessun account Google utilizzabile è stato restituito al dispositivo. Codice: no_credential.";
        }
        if (type.contains("UNSUPPORTED")) {
            return "Il servizio credenziali Google non è supportato o aggiornato su questo dispositivo. Codice: unsupported.";
        }

        return "Accesso Google non riuscito. Codice: " + type + ".";
    }

    @PluginMethod
    public void signIn(PluginCall call) {
        String serverClientId = call.getString("serverClientId");
        if (serverClientId == null || serverClientId.trim().isEmpty()) {
            call.reject("Google Client ID mancante");
            return;
        }

        GetSignInWithGoogleOption signInWithGoogleOption =
            new GetSignInWithGoogleOption.Builder(serverClientId.trim()).build();

        GetCredentialRequest request = new GetCredentialRequest.Builder()
            .addCredentialOption(signInWithGoogleOption)
            .build();

        CredentialManager credentialManager = CredentialManager.create(getActivity());
        CancellationSignal cancellationSignal = new CancellationSignal();
        Executor executor = ContextCompat.getMainExecutor(getActivity());

        credentialManager.getCredentialAsync(
            getActivity(),
            request,
            cancellationSignal,
            executor,
            new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                @Override
                public void onResult(GetCredentialResponse result) {
                    try {
                        Credential credential = result.getCredential();
                        if (!(credential instanceof CustomCredential)) {
                            call.reject("Tipo di credenziale Google non supportato");
                            return;
                        }

                        CustomCredential customCredential = (CustomCredential) credential;
                        if (!GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(customCredential.getType())) {
                            call.reject("Risposta Google inattesa: tipo credenziale non ID token");
                            return;
                        }

                        GoogleIdTokenCredential googleCredential =
                            GoogleIdTokenCredential.createFrom(customCredential.getData());

                        String idToken = googleCredential.getIdToken();
                        if (idToken == null || idToken.isEmpty()) {
                            call.reject("Google ha restituito una credenziale senza ID token");
                            return;
                        }

                        JSObject resultObject = new JSObject();
                        resultObject.put("idToken", idToken);
                        call.resolve(resultObject);
                    } catch (Exception error) {
                        call.reject("Impossibile leggere la credenziale Google (" + error.getClass().getSimpleName() + ")", error);
                    }
                }

                @Override
                public void onError(GetCredentialException error) {
                    call.reject(publicCredentialError(error), error);
                }
            }
        );
    }

    @PluginMethod
    public void clearState(PluginCall call) {
        CredentialManager credentialManager = CredentialManager.create(getActivity());
        ClearCredentialStateRequest request = new ClearCredentialStateRequest(
            ClearCredentialStateRequest.TYPE_CLEAR_CREDENTIAL_STATE
        );
        Executor executor = ContextCompat.getMainExecutor(getActivity());

        credentialManager.clearCredentialStateAsync(
            request,
            new CancellationSignal(),
            executor,
            new CredentialManagerCallback<Void, ClearCredentialException>() {
                @Override
                public void onResult(Void result) {
                    call.resolve();
                }

                @Override
                public void onError(ClearCredentialException error) {
                    call.reject("Impossibile pulire lo stato credenziali Android", error);
                }
            }
        );
    }
}
