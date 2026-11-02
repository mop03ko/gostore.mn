package mn.gostore.warehouse;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
public final class WarehouseMessagingService extends FirebaseMessagingService {
    @Override public void onNewToken(String token){WarehousePush.rotate(this,token);}
    @Override public void onMessageReceived(RemoteMessage message){
        if("warehouse-orders".equals(message.getData().get("type")))WarehousePush.receive(this);
        if("warehouse-test".equals(message.getData().get("type")))WarehousePush.receiveTest(this);
    }
}
