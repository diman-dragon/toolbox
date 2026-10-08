package __PKG__;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import androidx.core.content.pm.ShortcutInfoCompat;
import androidx.core.content.pm.ShortcutManagerCompat;
import androidx.core.graphics.drawable.IconCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONObject;

/**
 * Ярлыки инструментов.
 * pin        — закрепить ярлык на рабочем столе (его можно перетащить в папку);
 * setDynamic — меню по долгому нажатию на значок приложения;
 * getLaunchTool / событие "tool" — какой инструмент открыть (ярлык открывает только его).
 * Значки ярлыков: res/drawable-nodpi/sc_<id>.png (scripts/make-shortcut-icons.mjs).
 */
@CapacitorPlugin(name = "Shortcuts")
public class ShortcutsPlugin extends Plugin {
    private static final String EXTRA = "tool";

    private ShortcutInfoCompat build(String id, String title) {
        Context ctx = getContext();
        Intent intent = new Intent(ctx, MainActivity.class);
        intent.setAction(Intent.ACTION_VIEW);
        intent.putExtra(EXTRA, id);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        IconCompat icon;
        int res = ctx.getResources().getIdentifier("sc_" + id, "drawable", ctx.getPackageName());
        Bitmap bmp = res != 0 ? BitmapFactory.decodeResource(ctx.getResources(), res) : null;
        if (bmp != null) {
            icon = IconCompat.createWithAdaptiveBitmap(bmp);
        } else {
            icon = IconCompat.createWithResource(ctx, ctx.getApplicationInfo().icon);
        }

        return new ShortcutInfoCompat.Builder(ctx, "tool_" + id)
            .setShortLabel(title)
            .setLongLabel(title)
            .setIcon(icon)
            .setIntent(intent)
            .build();
    }

    @PluginMethod
    public void pin(PluginCall call) {
        String id = call.getString("id");
        String title = call.getString("title");
        if (id == null || title == null) {
            call.reject("id and title are required");
            return;
        }
        Context ctx = getContext();
        JSObject ret = new JSObject();
        boolean supported = ShortcutManagerCompat.isRequestPinShortcutSupported(ctx);
        ret.put("supported", supported);
        ret.put("requested", supported && ShortcutManagerCompat.requestPinShortcut(ctx, build(id, title), null));
        call.resolve(ret);
    }

    @PluginMethod
    public void setDynamic(PluginCall call) {
        JSArray items = call.getArray("items");
        if (items == null) {
            call.reject("items is required");
            return;
        }
        try {
            Context ctx = getContext();
            int max = Math.min(ShortcutManagerCompat.getMaxShortcutCountPerActivity(ctx), 4);
            List<ShortcutInfoCompat> list = new ArrayList<>();
            for (int i = 0; i < items.length() && list.size() < max; i++) {
                JSONObject o = items.getJSONObject(i);
                list.add(build(o.getString("id"), o.getString("title")));
            }
            ShortcutManagerCompat.setDynamicShortcuts(ctx, list);
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    @PluginMethod
    public void getLaunchTool(PluginCall call) {
        JSObject ret = new JSObject();
        Activity a = getActivity();
        if (a != null && a.getIntent() != null) {
            String id = a.getIntent().getStringExtra(EXTRA);
            if (id != null) {
                ret.put("id", id);
                a.getIntent().removeExtra(EXTRA); // обработано: повторно не открывать
            }
        }
        call.resolve(ret);
    }

    /** Ярлык нажат, когда приложение уже запущено (launchMode=singleTask). */
    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        String id = intent != null ? intent.getStringExtra(EXTRA) : null;
        if (id != null) {
            JSObject o = new JSObject();
            o.put("id", id);
            notifyListeners("tool", o, true);
        }
    }
}
