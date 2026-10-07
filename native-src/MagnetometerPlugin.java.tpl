package __PKG__;

import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Магнитометр (мкТл) → событие "mag" {x, y, z}. */
@CapacitorPlugin(name = "Magnetometer")
public class MagnetometerPlugin extends Plugin implements SensorEventListener {
    private SensorManager sm;

    @PluginMethod
    public void start(PluginCall call) {
        if (sm == null) {
            sm = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        }
        Sensor s = sm.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD);
        if (s == null) {
            call.reject("no magnetometer");
            return;
        }
        sm.unregisterListener(this);
        sm.registerListener(this, s, SensorManager.SENSOR_DELAY_GAME);
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (sm != null) sm.unregisterListener(this);
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        if (sm != null) sm.unregisterListener(this);
    }

    @Override
    public void onSensorChanged(SensorEvent e) {
        JSObject o = new JSObject();
        o.put("x", e.values[0]);
        o.put("y", e.values[1]);
        o.put("z", e.values[2]);
        notifyListeners("mag", o);
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {}
}
