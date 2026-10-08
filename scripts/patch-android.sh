#!/usr/bin/env bash
# Патч сгенерированного Android-проекта:
#  - экран не гаснет, пока открыто приложение;
#  - нативные плагины: магнитометр и ярлыки (MagnetometerPlugin, ShortcutsPlugin);
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
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }
}
JAVA
echo "Пропатчен: $FILE"

for P in MagnetometerPlugin ShortcutsPlugin; do
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
add_line 'android.permission.CAMERA' '<uses-permission android:name="android.permission.CAMERA" />'
add_line 'android.permission.RECORD_AUDIO' '<uses-permission android:name="android.permission.RECORD_AUDIO" />'
add_line 'android.permission.MODIFY_AUDIO_SETTINGS' '<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />'
add_line 'android.hardware.camera"' '<uses-feature android:name="android.hardware.camera" android:required="false" />'
add_line 'android.hardware.camera.autofocus' '<uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />'
add_line 'android.hardware.microphone' '<uses-feature android:name="android.hardware.microphone" android:required="false" />'

# Версия приложения
VERSION_NAME="${VERSION_NAME:-$(node -p "require('./package.json').version")}"
VERSION_CODE="${VERSION_CODE:-1}"
GRADLE=android/app/build.gradle
sed -i -E "s/versionCode [0-9]+/versionCode ${VERSION_CODE}/; s/versionName \"[^\"]*\"/versionName \"${VERSION_NAME}\"/" "$GRADLE"
echo "Версия: ${VERSION_NAME} (${VERSION_CODE})"
