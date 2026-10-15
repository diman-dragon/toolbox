package __PKG__;

import android.app.Activity;
import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ConsumeParams;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.List;

/**
 * Google Play Billing Library 8.0.0 — только разовые товары (без подписок):
 *   products — цены товаров; buy — покупка (consumable=true для «чаевых»: их можно покупать снова);
 *   owned    — ключи купленных непотребляемых товаров («Восстановить покупки»).
 * Покупки подтверждаются (acknowledge) или погашаются (consume) — иначе Google вернёт деньги через 3 дня.
 * Не проверялся компиляцией в среде разработки — проверяется сборкой CI и тестовой дорожкой Play.
 */
@CapacitorPlugin(name = "Billing")
public class BillingPlugin extends Plugin {
    private BillingClient client;
    private PluginCall pendingBuy;
    private boolean pendingConsumable;

    private void connect(Runnable ready, PluginCall call) {
        if (client != null && client.isReady()) {
            ready.run();
            return;
        }
        if (client == null) {
            client = BillingClient.newBuilder(getContext())
                .setListener((result, purchases) -> onPurchases(result, purchases))
                .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                .enableAutoServiceReconnection()
                .build();
        }
        client.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult r) {
                if (r.getResponseCode() == BillingClient.BillingResponseCode.OK) ready.run();
                else call.reject("billing unavailable: " + r.getResponseCode());
            }

            @Override
            public void onBillingServiceDisconnected() {
                /* переподключение автоматическое (enableAutoServiceReconnection) */
            }
        });
    }

    private List<QueryProductDetailsParams.Product> toProducts(JSArray ids) throws Exception {
        List<QueryProductDetailsParams.Product> list = new ArrayList<>();
        for (int i = 0; i < ids.length(); i++) {
            list.add(
                QueryProductDetailsParams.Product.newBuilder()
                    .setProductId(ids.getString(i))
                    .setProductType(BillingClient.ProductType.INAPP)
                    .build()
            );
        }
        return list;
    }

    @PluginMethod
    public void products(PluginCall call) {
        JSArray ids = call.getArray("ids");
        if (ids == null) {
            call.reject("ids is required");
            return;
        }
        connect(() -> {
            try {
                QueryProductDetailsParams p = QueryProductDetailsParams.newBuilder().setProductList(toProducts(ids)).build();
                client.queryProductDetailsAsync(p, (r, res) -> {
                    JSArray items = new JSArray();
                    for (ProductDetails d : res.getProductDetailsList()) {
                        ProductDetails.OneTimePurchaseOfferDetails o = d.getOneTimePurchaseOfferDetails();
                        if (o == null) continue;
                        JSObject it = new JSObject();
                        it.put("id", d.getProductId());
                        it.put("price", o.getFormattedPrice());
                        items.put(it);
                    }
                    JSObject ret = new JSObject();
                    ret.put("items", items);
                    call.resolve(ret);
                });
            } catch (Exception e) {
                call.reject(e.getMessage());
            }
        }, call);
    }

    @PluginMethod
    public void buy(PluginCall call) {
        String id = call.getString("id");
        Activity act = getActivity();
        if (id == null || act == null) {
            call.reject("id is required");
            return;
        }
        boolean consumable = Boolean.TRUE.equals(call.getBoolean("consumable", false));
        connect(() -> {
            try {
                JSArray one = new JSArray();
                one.put(id);
                QueryProductDetailsParams p = QueryProductDetailsParams.newBuilder().setProductList(toProducts(one)).build();
                client.queryProductDetailsAsync(p, (r, res) -> {
                    if (res.getProductDetailsList().isEmpty()) {
                        done(call, "unavailable");
                        return;
                    }
                    BillingFlowParams.ProductDetailsParams pd = BillingFlowParams.ProductDetailsParams.newBuilder()
                        .setProductDetails(res.getProductDetailsList().get(0))
                        .build();
                    BillingFlowParams flow = BillingFlowParams.newBuilder().setProductDetailsParamsList(java.util.Collections.singletonList(pd)).build();
                    pendingBuy = call;
                    pendingConsumable = consumable;
                    BillingResult lr = client.launchBillingFlow(act, flow);
                    if (lr.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                        pendingBuy = null;
                        done(call, "error");
                    }
                });
            } catch (Exception e) {
                call.reject(e.getMessage());
            }
        }, call);
    }

    private void done(PluginCall call, String result) {
        JSObject ret = new JSObject();
        ret.put("result", result);
        call.resolve(ret);
    }

    private void onPurchases(BillingResult r, List<Purchase> purchases) {
        PluginCall call = pendingBuy;
        pendingBuy = null;
        int code = r.getResponseCode();
        if (code == BillingClient.BillingResponseCode.USER_CANCELED) {
            if (call != null) done(call, "cancelled");
            return;
        }
        if (code != BillingClient.BillingResponseCode.OK || purchases == null) {
            if (call != null) done(call, "error");
            return;
        }
        for (Purchase p : purchases) {
            if (p.getPurchaseState() != Purchase.PurchaseState.PURCHASED) continue;
            if (pendingConsumable) {
                client.consumeAsync(ConsumeParams.newBuilder().setPurchaseToken(p.getPurchaseToken()).build(), (cr, t) -> {});
            } else if (!p.isAcknowledged()) {
                client.acknowledgePurchase(
                    AcknowledgePurchaseParams.newBuilder().setPurchaseToken(p.getPurchaseToken()).build(),
                    ar -> {}
                );
            }
        }
        if (call != null) done(call, "ok");
    }

    @PluginMethod
    public void owned(PluginCall call) {
        connect(() -> {
            client.queryPurchasesAsync(
                QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(),
                (r, list) -> {
                    JSArray ids = new JSArray();
                    for (Purchase p : list) {
                        if (p.getPurchaseState() != Purchase.PurchaseState.PURCHASED) continue;
                        if (!p.isAcknowledged()) {
                            client.acknowledgePurchase(
                                AcknowledgePurchaseParams.newBuilder().setPurchaseToken(p.getPurchaseToken()).build(),
                                ar -> {}
                            );
                        }
                        for (String pid : p.getProducts()) ids.put(pid);
                    }
                    JSObject ret = new JSObject();
                    ret.put("ids", ids);
                    call.resolve(ret);
                }
            );
        }, call);
    }
}
