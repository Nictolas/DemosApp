package community.demos;

import android.os.CancellationSignal;

import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
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
                            call.reject("Risposta Google inattesa");
                            return;
                        }

                        GoogleIdTokenCredential googleCredential =
                            GoogleIdTokenCredential.createFrom(customCredential.getData());

                        String idToken = googleCredential.getIdToken();
                        if (idToken == null || idToken.isEmpty()) {
                            call.reject("Google non ha restituito un ID token");
                            return;
                        }

                        JSObject resultObject = new JSObject();
                        resultObject.put("idToken", idToken);
                        call.resolve(resultObject);
                    } catch (Exception error) {
                        call.reject("Impossibile leggere la credenziale Google", error);
                    }
                }

                @Override
                public void onError(GetCredentialException error) {
                    call.reject("Accesso Google annullato o non riuscito", error);
                }
            }
        );
    }
}
