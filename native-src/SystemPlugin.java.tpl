package __PKG__;

import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.provider.Settings;
import android.view.Window;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Системное оформление и настройки.
 * setBars          — цвет строки состояния и навигации под тему, светлые/тёмные значки;
 * openAppSettings  — экран «О приложении» в настройках Android (разрешения).
 * Не проверялся компиляцией в среде разработки — проверяется сборкой CI.
 */
@CapacitorPlugin(name = "System")
public class SystemPlugin extends Plugin {
    @PluginMethod
    public void setBars(PluginCall call) {
        final String color = call.getString("color");
        final boolean light = Boolean.TRUE.equals(call.getBoolean("light", false));
        if (color == null) {
            call.reject("color is required");
            return;
        }
        getActivity().runOnUiThread(() -> {
            try {
                Window w = getActivity().getWindow();
                int c = Color.parseColor(color);
                w.setStatusBarColor(c);
                w.setNavigationBarColor(c);
                WindowInsetsControllerCompat ctl = WindowCompat.getInsetsController(w, w.getDecorView());
                ctl.setAppearanceLightStatusBars(light);
                ctl.setAppearanceLightNavigationBars(light);
                call.resolve();
            } catch (Exception e) {
                call.reject(e.getMessage());
            }
        });
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        try {
            Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            i.setData(Uri.fromParts("package", getContext().getPackageName(), null));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }
}
