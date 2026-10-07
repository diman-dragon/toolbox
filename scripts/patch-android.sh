#!/usr/bin/env bash
# Патч сгенерированного Android-проекта: экран не гаснет, пока открыто приложение.
set -euo pipefail

FILE=$(find android/app/src/main/java -name MainActivity.java | head -n1)
if [ -z "${FILE}" ]; then
  echo "MainActivity.java не найден — сначала выполните: npx cap add android" >&2
  exit 1
fi

PKG=$(grep -m1 '^package ' "$FILE" | sed 's/package \(.*\);/\1/')

cat > "$FILE" <<EOF
package ${PKG};

import android.os.Bundle;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }
}
EOF

echo "Пропатчен: $FILE"

# Иконка: адаптивная (вектор) + запасные PNG. Файлы лежат в native-res/res.
if [ -d native-res/res ]; then
  cp -r native-res/res/. android/app/src/main/res/
  echo "Иконка скопирована"
fi
