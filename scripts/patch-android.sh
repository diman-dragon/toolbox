#!/usr/bin/env bash
# Патч сгенерированного Android-проекта:
#  - экран не гаснет, пока открыто приложение;
#  - нативные плагины: магнитометр, ярлыки, система, покупки (Magnetometer/Shortcuts/System/Billing);
#  - иконка приложения и значки ярлыков; разрешения камеры и микрофона;
#  - версия (VERSION_NAME / VERSION_CODE).
set -euo pipefail

FILE=$(find android/app/src/main/java -name MainActivity.java | head -n1)
if [ -z "${FILE}" ]; then
  echo "MainActivity.java не найден — сначала выполните: npx cap add android" >&2
  exit 1
fi

PKG=$(grep -m1 '^package ' "$FILE" | sed 's/package \(.*\);/\1/')
DIR=$(dirname "$FILE")

cat > "$FILE" <<JAVA
package ${PKG};

import android.os.Bundle;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MagnetometerPlugin.class);
        registerPlugin(ShortcutsPlugin.class);
        registerPlugin(SystemPlugin.class);
        registerPlugin(BillingPlugin.class);
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }
}
JAVA
echo "Пропатчен: $FILE"

for P in MagnetometerPlugin ShortcutsPlugin SystemPlugin BillingPlugin; do
  sed "s/__PKG__/${PKG}/" "native-src/${P}.java.tpl" > "${DIR}/${P}.java"
  echo "Плагин добавлен: ${P}"
done

# Иконка (адаптивная + запасные PNG) и значки ярлыков sc_<id>.png: native-res/res
if [ -d native-res/res ]; then
  cp -r native-res/res/. android/app/src/main/res/
  echo "Ресурсы скопированы (иконка, значки ярлыков)"
fi

# Разрешения и необходимость оборудования. required=false — приложение остаётся доступным
# в Google Play на устройствах без камеры, автофокуса или микрофона.
MANIFEST=android/app/src/main/AndroidManifest.xml
add_line() { # $1 — признак, по которому проверяем наличие, $2 — строка манифеста
  if ! grep -q "$1" "$MANIFEST"; then
    sed -i "s#</manifest>#    $2\n</manifest>#" "$MANIFEST"
    echo "В манифест добавлено: $1"
  fi
}
add_line 'com.android.vending.BILLING' '<uses-permission android:name="com.android.vending.BILLING" />'
add_line 'android.permission.CAMERA' '<uses-permission android:name="android.permission.CAMERA" />'
add_line 'android.permission.RECORD_AUDIO' '<uses-permission android:name="android.permission.RECORD_AUDIO" />'
add_line 'android.permission.MODIFY_AUDIO_SETTINGS' '<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />'
add_line 'android.hardware.camera"' '<uses-feature android:name="android.hardware.camera" android:required="false" />'
add_line 'android.hardware.camera.autofocus' '<uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />'
add_line 'android.hardware.microphone' '<uses-feature android:name="android.hardware.microphone" android:required="false" />'

# Покупки: Play Billing Library 8.0.0 (только разовые товары)
GRADLE=android/app/build.gradle
if ! grep -q 'com.android.billingclient:billing' "$GRADLE"; then
  sed -i '/^dependencies {/a\    implementation "com.android.billingclient:billing:8.0.0"' "$GRADLE"
  echo "Добавлена зависимость: Play Billing 8.0.0"
fi

# Уровни API: minSdk 24, compile/target 36 (Capacitor хранит их в variables.gradle)
VARS=android/variables.gradle
if [ -f "$VARS" ]; then
  sed -i -E "s/minSdkVersion = [0-9]+/minSdkVersion = 24/; s/compileSdkVersion = [0-9]+/compileSdkVersion = 36/; s/targetSdkVersion = [0-9]+/targetSdkVersion = 36/" "$VARS"
fi

# Версия приложения. versionCode считается из версии (major*10000 + minor*100 + patch),
# а не из номера запуска CI: так он монотонен, повторяем и совпадает с package.json.
VERSION_NAME="${VERSION_NAME:-$(node -p "require('./package.json').version")}"
VERSION_CODE="${VERSION_CODE:-$(node -p "const [a,b,c]=require('./package.json').version.split('.').map(Number);a*10000+b*100+c")}"
sed -i -E "s/versionCode [0-9]+/versionCode ${VERSION_CODE}/; s/versionName \"[^\"]*\"/versionName \"${VERSION_NAME}\"/" "$GRADLE"
echo "Версия: ${VERSION_NAME} (${VERSION_CODE})"
