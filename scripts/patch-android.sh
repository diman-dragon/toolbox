#!/usr/bin/env bash
# Патч сгенерированного Android-проекта:
#  - экран не гаснет, пока открыто приложение;
#  - нативный плагин магнитометра (MagnetometerPlugin);
#  - иконка; версия (VERSION_NAME / VERSION_CODE).
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
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }
}
JAVA
echo "Пропатчен: $FILE"

sed "s/__PKG__/${PKG}/" native-src/MagnetometerPlugin.java.tpl > "${DIR}/MagnetometerPlugin.java"
echo "Плагин магнитометра добавлен"

# Иконка: адаптивная (вектор) + запасные PNG. Файлы лежат в native-res/res.
if [ -d native-res/res ]; then
  cp -r native-res/res/. android/app/src/main/res/
  echo "Иконка скопирована"
fi

# Разрешение камеры (инструмент «Отвес»)
MANIFEST=android/app/src/main/AndroidManifest.xml
if ! grep -q 'android.permission.CAMERA' "$MANIFEST"; then
  sed -i 's#</manifest>#    <uses-permission android:name="android.permission.CAMERA" />\n    <uses-feature android:name="android.hardware.camera" android:required="false" />\n</manifest>#' "$MANIFEST"
  echo "Разрешение камеры добавлено"
fi

# Версия приложения
VERSION_NAME="${VERSION_NAME:-$(node -p "require('./package.json').version")}"
VERSION_CODE="${VERSION_CODE:-1}"
GRADLE=android/app/build.gradle
sed -i -E "s/versionCode [0-9]+/versionCode ${VERSION_CODE}/; s/versionName \"[^\"]*\"/versionName \"${VERSION_NAME}\"/" "$GRADLE"
echo "Версия: ${VERSION_NAME} (${VERSION_CODE})"
