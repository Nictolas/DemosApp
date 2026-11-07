package community.demos;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeGoogleAuthPlugin.class);
        registerPlugin(NativePlayIntegrityPlugin.class);
        // Bridge registration is passive; the feature is OFF at the build gate.
        registerPlugin(NativeFirebaseAppCheckPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
