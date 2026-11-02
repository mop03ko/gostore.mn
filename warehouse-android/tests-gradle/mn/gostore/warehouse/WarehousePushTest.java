package mn.gostore.warehouse;
import android.app.*;
import android.content.*;
import com.google.firebase.*;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import static org.junit.Assert.*;
@RunWith(RobolectricTestRunner.class)
@Config(sdk=28)
public class WarehousePushTest {
    Context c; NotificationManager nm;
    @Before public void setup(){
        c=RuntimeEnvironment.getApplication();nm=c.getSystemService(NotificationManager.class);
        if(FirebaseApp.getApps(c).isEmpty())FirebaseApp.initializeApp(c,new FirebaseOptions.Builder().setApplicationId("1:123:android:test").setApiKey("test-api-key").setProjectId("test").build());
        WarehousePush.prefs(c).edit().clear().putString("token","test-secret").putString("location","erenhot").putString("language","zh").commit();
        nm.cancelAll();WarehousePush.channel(c);
    }
    JSONObject notice() throws Exception{return new JSONObject("{\"location\":\"erenhot\",\"language\":\"zh\",\"notifications\":[{\"id\":42,\"order_id\":\"GS-TEST42\"}]}");}
    @Test public void notificationOpensScopedOrderAndDeduplicates() throws Exception {
        WarehousePush.receive(c,token->notice());
        assertEquals(1,nm.getActiveNotifications().length);
        Notification n=nm.getActiveNotifications()[0].getNotification();
        assertEquals("GOStore · 新订单已确认",n.extras.getString(Notification.EXTRA_TITLE));
        assertFalse(n.publicVersion.extras.getString(Notification.EXTRA_TEXT).contains("GS-TEST42"));
        Intent intent=Shadows.shadowOf(n.contentIntent).getSavedIntent();
        assertEquals("https://gostore.mn/warehouse/?location=erenhot&order=GS-TEST42",intent.getDataString());
        nm.cancelAll();WarehousePush.receive(c,token->notice());assertEquals(0,nm.getActiveNotifications().length);
    }
    @Test public void revokedDeviceNeverShowsNotification(){
        WarehousePush.receive(c,token->{throw new WarehousePush.HttpError(401);});
        assertEquals(0,nm.getActiveNotifications().length);assertFalse(WarehousePush.enabled(c));
    }
    @Test public void logoutDuringFetchSuppressesStaleOrder(){
        WarehousePush.receive(c,token->{WarehousePush.prefs(c).edit().clear().commit();return notice();});
        assertEquals(0,nm.getActiveNotifications().length);
    }
    @Test public void emptyOrReassignedOrdersDoNotNotify(){
        WarehousePush.receive(c,token->new JSONObject("{\"notifications\":[]}"));assertEquals(0,nm.getActiveNotifications().length);
    }
    @Test public void offlineWakeupUsesGenericTextWithoutOrder(){
        WarehousePush.receive(c,token->{throw new java.io.IOException("offline");});
        assertEquals(1,nm.getActiveNotifications().length);
        assertEquals("请打开仓库查看新订单。",nm.getActiveNotifications()[0].getNotification().extras.getString(Notification.EXTRA_TEXT));
    }
    @Test public void channelDeniedPreventsFetchAndNotification(){
        nm.createNotificationChannel(new NotificationChannel(WarehousePush.CHANNEL,"Muted",NotificationManager.IMPORTANCE_NONE));
        WarehousePush.receive(c,token->{fail("Fetch with muted notifications");return notice();});assertEquals(0,nm.getActiveNotifications().length);
    }
    @Test public void serverTestWorksWithoutCreatingAnOrder(){
        WarehousePush.receive(c,token->new JSONObject("{\"location\":\"erenhot\",\"language\":\"zh\",\"notifications\":[]}"),true);
        assertEquals(1,nm.getActiveNotifications().length);
        assertEquals("GOStore · 推送测试成功",nm.getActiveNotifications()[0].getNotification().extras.getString(Notification.EXTRA_TITLE));
    }
}
