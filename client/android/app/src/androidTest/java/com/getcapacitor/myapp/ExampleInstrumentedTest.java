package com.getcapacitor.myapp;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.app.Activity;
import android.app.Instrumentation;
import android.content.Context;
import android.content.Intent;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import community.demos.MainActivity;

import org.junit.Test;
import org.junit.runner.RunWith;

/**
 * Native offline smoke tests for the actual DEMOS Capacitor Android shell.
 * No credentials, real-user data or production API requests are required.
 * These do not replace authenticated end-to-end testing of Opinions.
 */
@RunWith(AndroidJUnit4.class)
public class ExampleInstrumentedTest {

    private WebView findWebView(View root) {
        if (root instanceof WebView) {
            return (WebView) root;
        }
        if (root instanceof ViewGroup) {
            ViewGroup group = (ViewGroup) root;
            for (int i = 0; i < group.getChildCount(); i++) {
                WebView match = findWebView(group.getChildAt(i));
                if (match != null) {
                    return match;
                }
            }
        }
        return null;
    }

    @Test
    public void packageNameMatchesPublishedApp() {
        Context target = InstrumentationRegistry.getInstrumentation().getTargetContext();
        assertEquals("community.demos", target.getPackageName());
    }

    @Test
    public void nativeActivityStartsAndCreatesJavaScriptWebView() {
        Instrumentation instrumentation = InstrumentationRegistry.getInstrumentation();
        Context context = instrumentation.getTargetContext();
        Intent intent = new Intent(context, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        Activity activity = instrumentation.startActivitySync(intent);
        try {
            instrumentation.waitForIdleSync();
            assertTrue("DEMOS MainActivity should open", activity instanceof MainActivity);
            // Android WebView can only be queried from its owning UI thread.
            instrumentation.runOnMainSync(() -> {
                View content = activity.findViewById(android.R.id.content);
                assertNotNull("Native activity must contain its content view", content);
                WebView webView = findWebView(content);
                assertNotNull("Capacitor should mount a WebView", webView);
                assertTrue("DEMOS frontend needs JavaScript enabled", webView.getSettings().getJavaScriptEnabled());
            });
        } finally {
            if (activity != null) {
                activity.runOnUiThread(activity::finish);
            }
        }
    }
}
