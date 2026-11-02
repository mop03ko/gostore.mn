package mn.gostore.warehouse;

import android.app.*;
import android.content.*;
import android.net.Uri;
import android.os.Build;
import android.content.pm.PackageManager;
import com.google.firebase.messaging.FirebaseMessaging;
import org.json.*;
import java.net.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.*;

/** Only native code handles the device credential; JavaScript never receives it. */
final class WarehousePush {
    static final String API="https://gostore.mn/api/index.php?action=", CHANNEL="warehouse-orders";
    static final ExecutorService IO=Executors.newSingleThreadExecutor();
    private static final Object LOCK=new Object();
    static volatile int generation=0;
    static android.content.SharedPreferences prefs(Context c){return c.getSharedPreferences("warehouse-push",Context.MODE_PRIVATE);}
    static boolean enabled(Context c){return !prefs(c).getString("token","").isEmpty();}
    static void channel(Context c){
        NotificationChannel channel=new NotificationChannel(CHANNEL,"GOStore 仓库 / Агуулах",NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("新订单通知 / Шинэ захиалгын мэдэгдэл");
        c.getSystemService(NotificationManager.class).createNotificationChannel(channel);
    }
    static boolean permission(Context c){
        if(Build.VERSION.SDK_INT>=33&&c.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)return false;
        NotificationManager nm=c.getSystemService(NotificationManager.class);
        NotificationChannel ch=nm.getNotificationChannel(CHANNEL);
        return nm.areNotificationsEnabled()&&(ch==null||ch.getImportance()!=NotificationManager.IMPORTANCE_NONE);
    }
    static final class HttpError extends IOException {final int status;HttpError(int s){super("HTTP "+s);status=s;}}
    static JSONObject request(String action,JSONObject data,String token,String cookie,String csrf) throws Exception {
        HttpURLConnection connection=(HttpURLConnection)new URL(API+action).openConnection();
        connection.setConnectTimeout(2500);connection.setReadTimeout(4000);connection.setInstanceFollowRedirects(false);
        connection.setRequestProperty("Accept","application/json");
        if(token!=null&&!token.isEmpty())connection.setRequestProperty("X-GOStore-Push-Token",token);
        if(cookie!=null&&!cookie.isEmpty())connection.setRequestProperty("Cookie",cookie);
        if(csrf!=null)connection.setRequestProperty("X-CSRF-Token",csrf);
        try{
            if(data!=null){connection.setRequestMethod("POST");connection.setDoOutput(true);connection.setRequestProperty("Content-Type","application/json");
                try(OutputStream out=connection.getOutputStream()){out.write(data.toString().getBytes(StandardCharsets.UTF_8));}}
            int status=connection.getResponseCode();if(status<200||status>=300)throw new HttpError(status);
            ByteArrayOutputStream bytes=new ByteArrayOutputStream();
            try(InputStream input=connection.getInputStream()){byte[] buffer=new byte[4096];int n;while((n=input.read(buffer))!=-1){bytes.write(buffer,0,n);if(bytes.size()>262144)throw new IOException("Response too large");}}
            return new JSONObject(bytes.toString("UTF-8"));
        }finally{connection.disconnect();}
    }
    static String bind(Context c,String fcm,String cookie,int expectedGeneration) throws Exception {
        JSONObject session=request("warehouse-session",null,null,cookie,null);
        if(!session.optBoolean("authenticated"))throw new HttpError(401);
        JSONObject body=new JSONObject().put("fcm_token",fcm);
        JSONObject binding=request("warehouse-fcm-subscribe",body,null,cookie,session.getString("csrf"));
        String token=binding.getString("token");
        synchronized(LOCK){
            if(generation==expectedGeneration){
                prefs(c).edit().putString("token",token).putString("fcm",fcm).putString("location",binding.getString("location"))
                    .putString("language",binding.getString("language")).putLong("seen",0).commit();
                FirebaseMessaging.getInstance().setAutoInitEnabled(true);
                return binding.getString("language");
            }
        }
        try{request("warehouse-push-revoke",new JSONObject(),token,null,null);}catch(Exception ignored){}
        throw new IOException("Binding cancelled");
    }
    static void clear(Context context){
        Context c=context.getApplicationContext();final String token;
        synchronized(LOCK){generation++;token=prefs(c).getString("token","");prefs(c).edit().clear().commit();c.getSystemService(NotificationManager.class).cancelAll();}
        FirebaseMessaging.getInstance().setAutoInitEnabled(false);
        IO.execute(()->{try{if(!token.isEmpty())request("warehouse-push-revoke",new JSONObject(),token,null,null);}catch(Exception ignored){};});
    }
    static void rotate(Context context,String fcm){
        Context c=context.getApplicationContext();IO.execute(()->{
            String token=prefs(c).getString("token","");if(token.isEmpty()||fcm.equals(prefs(c).getString("fcm","")))return;
            try{request("warehouse-fcm-rotate",new JSONObject().put("fcm_token",fcm),token,null,null);
                synchronized(LOCK){if(token.equals(prefs(c).getString("token","")))prefs(c).edit().putString("fcm",fcm).apply();}
            }catch(HttpError e){if(e.status==401)clearIfCurrent(c,token);}catch(Exception ignored){}
        });
    }
    static void clearIfCurrent(Context c,String token){synchronized(LOCK){if(token.equals(prefs(c).getString("token",""))){
        generation++;prefs(c).edit().clear().commit();c.getSystemService(NotificationManager.class).cancelAll();FirebaseMessaging.getInstance().setAutoInitEnabled(false);
    }}}
    interface Delivery { JSONObject get(String token) throws Exception; }
    static void receive(Context c){receive(c,token->request("warehouse-push-delivery",null,token,null,null));}
    static void receiveTest(Context c){receive(c,token->request("warehouse-push-delivery",null,token,null,null),true);}
    static void receive(Context c,Delivery delivery){receive(c,delivery,false);}
    static void receive(Context c,Delivery delivery,boolean test){
        String token=prefs(c).getString("token","");if(token.isEmpty()||!permission(c))return;
        String location=prefs(c).getString("location","erenhot"),order="";long notice=0;
        boolean zh="zh".equals(prefs(c).getString("language","zh"));
        try{
            JSONObject response=delivery.get(token);
            JSONArray items=response.getJSONArray("notifications");if(items.length()==0&&!test)return;
            if(!test){JSONObject latest=items.getJSONObject(0);order=latest.getString("order_id");notice=latest.getLong("id");}
            location=response.getString("location");zh="zh".equals(response.getString("language"));
        }catch(HttpError e){if(e.status==401){clearIfCurrent(c,token);return;}}catch(Exception ignored){}
        synchronized(LOCK){
            if(!token.equals(prefs(c).getString("token",""))||!permission(c))return;
            if(notice>0&&notice<=prefs(c).getLong("seen",0))return;
            Uri.Builder url=Uri.parse("https://gostore.mn/warehouse/").buildUpon().appendQueryParameter("location",location);
            if(order.matches("[A-Z0-9-]{3,50}"))url.appendQueryParameter("order",order);
            Intent intent=new Intent(c,WarehouseActivity.class).setData(url.build()).setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
            PendingIntent pending=PendingIntent.getActivity(c,0,intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
            String title=zh?"GOStore · 新订单已确认":"GOStore · Шинэ захиалга баталгаажлаа";
            String body=order.isEmpty()?(zh?"请打开仓库查看新订单。":"Агуулахын шинэ захиалгаа шалгана уу."):order+(zh?" · 请查看仓库订单":" · Захиалгыг нээж үзнэ үү");
            if(test){title=zh?"GOStore · 推送测试成功":"GOStore · Push туршилт амжилттай";body=zh?"此设备已收到服务器发送的测试通知。":"Серверээс илгээсэн туршилтын мэдэгдэл ирлээ.";}
            channel(c);
            Notification notification=new Notification.Builder(c,CHANNEL).setSmallIcon(R.drawable.notification_icon).setContentTitle(title).setContentText(body)
                .setContentIntent(pending).setAutoCancel(true).setVisibility(Notification.VISIBILITY_PRIVATE)
                .setPublicVersion(new Notification.Builder(c,CHANNEL).setSmallIcon(R.drawable.notification_icon).setContentTitle("GOStore").setContentText(zh?"仓库通知":"Агуулахын мэдэгдэл").build()).build();
            c.getSystemService(NotificationManager.class).notify(1001,notification);
            if(notice>0)prefs(c).edit().putLong("seen",notice).apply();
        }
    }
    private WarehousePush(){}
}
