package mn.gostore.warehouse;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.view.Gravity;
import android.view.View;
import android.webkit.*;
import android.widget.*;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.util.UUID;

public final class WarehouseActivity extends Activity {
    private static final int PICK_IMAGE = 10, TAKE_PHOTO = 11, SCAN_PERMISSION = 20, PHOTO_PERMISSION = 21;
    private WebView web;
    private ProgressBar progress;
    private LinearLayout error;
    private ValueCallback<Uri[]> fileCallback;
    private PermissionRequest cameraRequest;
    private Uri captureUri;
    private boolean pageFailed;
    private int dp(int size) { return (int)(getResources().getDisplayMetrics().density * size + .5f); }
    private void toast(String text) { Toast.makeText(this,text,Toast.LENGTH_LONG).show(); }
    private boolean trustedPage() { return web != null && NavigationPolicy.warehousePage(web.getUrl()); }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        // Old captures are temporary; keep recent files while a chooser or WebView still uses them.
        File directory = new File(getCacheDir(),"camera"); directory.mkdirs();
        File[] files = directory.listFiles();
        if (files != null) for (File f : files) if (f.lastModified() < System.currentTimeMillis()-86400000L) f.delete();
        LinearLayout root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL); root.setBackgroundColor(Color.WHITE);
        root.setOnApplyWindowInsetsListener((view,insets)->{view.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets;});
        LinearLayout bar = new LinearLayout(this);bar.setGravity(Gravity.CENTER_VERTICAL);bar.setPadding(dp(12),0,dp(8),0);bar.setBackgroundColor(Color.rgb(19,35,68));
        TextView name = new TextView(this);name.setText("GOStore · 二连仓库");name.setTextSize(18);name.setTextColor(Color.WHITE);
        bar.addView(name,new LinearLayout.LayoutParams(0,dp(52),1));name.setGravity(Gravity.CENTER_VERTICAL);
        Button refresh = new Button(this);refresh.setText("刷新");refresh.setContentDescription("刷新仓库页面");bar.addView(refresh);
        refresh.setOnClickListener(v->new AlertDialog.Builder(this).setTitle("刷新页面？").setMessage("未保存的内容将丢失。请先确认操作结果。").setNegativeButton("取消",null).setPositiveButton("刷新",(d,w)->openHome()).show());
        root.addView(bar);progress=new ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal);root.addView(progress,new LinearLayout.LayoutParams(-1,dp(3)));
        FrameLayout content=new FrameLayout(this);root.addView(content,new LinearLayout.LayoutParams(-1,0,1));
        web=new WebView(this);content.addView(web,new FrameLayout.LayoutParams(-1,-1));
        error=new LinearLayout(this);error.setOrientation(LinearLayout.VERTICAL);error.setGravity(Gravity.CENTER);error.setPadding(dp(24),dp(24),dp(24),dp(24));error.setBackgroundColor(Color.WHITE);
        TextView message=new TextView(this);message.setText("暂时无法连接仓库系统\n请检查网络后重试。未确认的操作请先查询状态，不要重复提交。");message.setGravity(Gravity.CENTER);message.setTextSize(17);error.addView(message);
        Button retry=new Button(this);retry.setText("重新连接");retry.setOnClickListener(v->openHome());error.addView(retry);content.addView(error,new FrameLayout.LayoutParams(-1,-1));error.setVisibility(View.GONE);
        setContentView(root);
        WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);settings.setAllowContentAccess(true);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setGeolocationEnabled(false);settings.setMediaPlaybackRequiresUserGesture(false);settings.setSupportMultipleWindows(false);
        settings.setUserAgentString(settings.getUserAgentString()+" GOStoreWarehouse/1.0.0");
        CookieManager.getInstance().setAcceptCookie(true);CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
        WebView.setWebContentsDebuggingEnabled(false);
        web.setWebViewClient(new WebViewClient(){
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
                String url=request.getUrl().toString();
                if(!request.isForMainFrame())return !NavigationPolicy.trustedOrigin(url);
                if(url.equals("gostore-warehouse://print")&&trustedPage()){printPage();return true;}
                if(NavigationPolicy.warehousePage(url)||NavigationPolicy.photoPage(url))return false;
                if(request.hasGesture()&&url.startsWith("https://")){
                    try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(url)));}catch(Exception e){toast("无法打开链接");}
                }
                return true;
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){
                String scheme=request.getUrl().getScheme();
                if(("https".equals(scheme)&&NavigationPolicy.trustedOrigin(request.getUrl().toString()))||"data".equals(scheme)||"blob".equals(scheme))return null;
                return new WebResourceResponse("text/plain","UTF-8",403,"Blocked",null,new ByteArrayInputStream(new byte[0]));
            }
            @Override public void onPageStarted(WebView v,String url,android.graphics.Bitmap icon){pageFailed=false;progress.setVisibility(View.VISIBLE);error.setVisibility(View.GONE);}
            @Override public void onPageFinished(WebView v,String url){
                progress.setVisibility(View.GONE);CookieManager.getInstance().flush();
                if(pageFailed||!NavigationPolicy.warehousePage(url))return;
                // No native JavaScript bridge or embedded credentials. Printing uses a guarded navigation.
                v.evaluateJavascript("window.print=function(){location.href='gostore-warehouse://print';};if(!window.goStoreNativeLinks){window.goStoreNativeLinks=true;document.addEventListener('click',function(e){const a=e.target.closest('a');if(a)a.removeAttribute('target');},true);}",null);
            }
            @Override public void onReceivedError(WebView v,WebResourceRequest r,WebResourceError e){if(r.isForMainFrame())showError();}
            @Override public void onReceivedHttpError(WebView v,WebResourceRequest r,WebResourceResponse e){if(r.isForMainFrame())showError();}
            @Override public void onReceivedSslError(WebView v,SslErrorHandler handler,SslError e){handler.cancel();showError();}
            @Override public boolean onRenderProcessGone(WebView v,RenderProcessGoneDetail d){
                ((FrameLayout)v.getParent()).removeView(v);v.destroy();web=null;recreate();return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient(){
            @Override public void onProgressChanged(WebView v,int value){progress.setProgress(value);}
            @Override public boolean onJsAlert(WebView v,String u,String text,JsResult result){new AlertDialog.Builder(WarehouseActivity.this).setMessage(text).setPositiveButton("确定",(d,w)->result.confirm()).setOnCancelListener(d->result.cancel()).show();return true;}
            @Override public boolean onJsConfirm(WebView v,String u,String text,JsResult result){new AlertDialog.Builder(WarehouseActivity.this).setMessage(text).setPositiveButton("确定",(d,w)->result.confirm()).setNegativeButton("取消",(d,w)->result.cancel()).setOnCancelListener(d->result.cancel()).show();return true;}
            @Override public boolean onShowFileChooser(WebView v,ValueCallback<Uri[]> callback,FileChooserParams params){
                finishFile(null);if(!trustedPage()){callback.onReceiveValue(null);return true;}fileCallback=callback;
                if(params.isCaptureEnabled()){
                    if(checkSelfPermission(Manifest.permission.CAMERA)!=PackageManager.PERMISSION_GRANTED)requestPermissions(new String[]{Manifest.permission.CAMERA},PHOTO_PERMISSION);else takePhoto();
                }else{
                    Intent pick=new Intent(Intent.ACTION_GET_CONTENT);pick.setType("image/*");pick.addCategory(Intent.CATEGORY_OPENABLE);pick.putExtra(Intent.EXTRA_MIME_TYPES,new String[]{"image/jpeg","image/png","image/webp"});
                    try{startActivityForResult(Intent.createChooser(pick,"选择照片"),PICK_IMAGE);}catch(Exception e){finishFile(null);toast("没有可用的图片选择器");}
                }return true;
            }
            @Override public void onPermissionRequest(PermissionRequest request){runOnUiThread(()->{
                if(!trustedPage()||!NavigationPolicy.trustedOrigin(request.getOrigin().toString())||request.getResources().length!=1||!PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(request.getResources()[0])){request.deny();return;}
                if(cameraRequest!=null)cameraRequest.deny();cameraRequest=request;
                if(checkSelfPermission(Manifest.permission.CAMERA)==PackageManager.PERMISSION_GRANTED)grantScanner();else requestPermissions(new String[]{Manifest.permission.CAMERA},SCAN_PERMISSION);
            });}
            @Override public void onPermissionRequestCanceled(PermissionRequest request){if(cameraRequest==request)cameraRequest=null;}
        });
        openHome();
    }
    private void showError(){pageFailed=true;progress.setVisibility(View.GONE);error.setVisibility(View.VISIBLE);}
    private void openHome(){if(web!=null)web.loadUrl(NavigationPolicy.HOME);}
    private void grantScanner(){if(cameraRequest==null)return;if(trustedPage())cameraRequest.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});else cameraRequest.deny();cameraRequest=null;}
    private void finishFile(Uri uri){if(fileCallback!=null){fileCallback.onReceiveValue(uri==null?null:new Uri[]{uri});fileCallback=null;}}
    private void takePhoto(){
        if(!trustedPage()){finishFile(null);return;}
        try{
            String name=UUID.randomUUID().toString().replace("-","")+".jpg";File f=new File(new File(getCacheDir(),"camera"),name);if(!f.createNewFile())throw new Exception();
            captureUri=new Uri.Builder().scheme("content").authority(CaptureProvider.AUTHORITY).appendPath(name).build();
            Intent camera=new Intent(MediaStore.ACTION_IMAGE_CAPTURE);camera.putExtra(MediaStore.EXTRA_OUTPUT,captureUri);camera.setClipData(ClipData.newRawUri("receipt",captureUri));camera.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION|Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivityForResult(camera,TAKE_PHOTO);
        }catch(Exception e){captureUri=null;finishFile(null);toast("无法打开相机，请选择已有照片");}
    }
    @Override public void onActivityResult(int code,int result,Intent data){
        super.onActivityResult(code,result,data);
        if(code!=PICK_IMAGE&&code!=TAKE_PHOTO)return;
        Uri uri=null;
        try { if(result==RESULT_OK&&trustedPage()){
            if(code==TAKE_PHOTO&&captureUri!=null){File file=new File(new File(getCacheDir(),"camera"),captureUri.getLastPathSegment());if(file.length()>0&&file.length()<=20*1024*1024)uri=captureUri;else toast("照片为空或超过20MB，请重新选择");}
            else if(data!=null&&data.getData()!=null){Uri picked=data.getData();String type=getContentResolver().getType(picked);if("content".equals(picked.getScheme())&&!CaptureProvider.AUTHORITY.equals(picked.getAuthority())&&type!=null&&type.startsWith("image/"))uri=picked;}
        }} catch (RuntimeException e) { toast("无法读取照片，请重新选择"); }
        if(captureUri!=null)revokeUriPermission(captureUri,Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        captureUri=null;finishFile(uri);
    }
    @Override public void onRequestPermissionsResult(int code,String[] permissions,int[] results){
        super.onRequestPermissionsResult(code,permissions,results);boolean allowed=results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED;
        if(code==SCAN_PERMISSION){if(allowed)grantScanner();else if(cameraRequest!=null){cameraRequest.deny();cameraRequest=null;}}
        if(code==PHOTO_PERMISSION){if(allowed)takePhoto();else{finishFile(null);toast("相机权限未开启，可以选择已有照片");}}
    }
    private void printPage(){
        if(!trustedPage()||pageFailed)return;
        web.evaluateJavascript("document.querySelector('#print-area')?.dataset.format||''",format->{
            if(!trustedPage())return;
            PrintAttributes.MediaSize size="\"label\"".equals(format)?new PrintAttributes.MediaSize("GOSTORE_100_150","100 × 150 mm",3937,5906):PrintAttributes.MediaSize.ISO_A4;
            PrintManager manager=(PrintManager)getSystemService(PRINT_SERVICE);
            try{manager.print("GOStore 仓库",web.createPrintDocumentAdapter("GOStore"),new PrintAttributes.Builder().setMediaSize(size).setMinMargins(PrintAttributes.Margins.NO_MARGINS).setColorMode(PrintAttributes.COLOR_MODE_MONOCHROME).build());}catch(Exception e){toast("无法打印，请安装打印服务或保存为PDF");}
        });
    }
    @Override public void onBackPressed(){
        if(web==null){super.onBackPressed();return;}
        web.evaluateJavascript("(()=>{const d=document.querySelector('dialog[open]');if(d){d.close();return true;}return false;})()",closed->{if("true".equals(closed))return;if(web.canGoBack())web.goBack();else new AlertDialog.Builder(this).setMessage("退出仓库应用？").setNegativeButton("取消",null).setPositiveButton("退出",(d,w)->finish()).show();});
    }
    @Override protected void onPause(){if(web!=null){web.evaluateJavascript("window.stopBatchScanner?.()",null);web.onPause();CookieManager.getInstance().flush();}super.onPause();}
    @Override protected void onResume(){super.onResume();if(web!=null)web.onResume();}
    @Override protected void onDestroy(){finishFile(null);if(cameraRequest!=null){cameraRequest.deny();cameraRequest=null;}if(web!=null){web.destroy();web=null;}super.onDestroy();}
}
