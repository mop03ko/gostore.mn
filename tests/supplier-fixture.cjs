// Synthetic provider responses: test runs must never consume the live OT API quota.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const raw={Id:'abb-123456789',Title:'Тест үүргэвч',MainPictureUrl:'https://img.alicdn.com/fixture.jpg',IsSellAllowed:true,Price:{OriginalPrice:10,OriginalCurrencyCode:'CNY'},FirstLotQuantity:2,NextLotQuantity:2,ConfiguredItems:[{Id:'blue',Quantity:10,Price:{OriginalPrice:10,OriginalCurrencyCode:'CNY'}}]};
function seedSupplier(data,expires=Math.floor(Date.now()/1000)+3600){
  const root=path.resolve(data);if(!root.startsWith(path.resolve(__dirname,'../tmp')+path.sep))throw Error('Isolated test data required');
  const dir=path.join(root,'supplier-cache');fs.mkdirSync(dir,{recursive:true});
  const responses={
    '/v1/alibaba1688/product/123456789?language=mn':{Item:raw},
    '/v1/taobao/product/123456789?language=mn':{Item:{...raw,Id:'123456789',ProviderType:'Taobao'}},
    '/v1/taobao/search?item_title=bag&language=mn&limit=12&page=1&sort=default':{Items:{Items:{Content:[{...raw,Id:'123456789',ProviderType:'Taobao'}],TotalCount:1},MaximumPageCount:1}}
  };
  for(const [key,data] of Object.entries({...responses,...Object.fromEntries(Object.entries(responses).filter(([k])=>k.includes('limit=12')).map(([k,v])=>[k.replace('limit=12','limit=50'),v]))}))fs.writeFileSync(path.join(dir,crypto.createHash('sha256').update(key).digest('hex')+'.json'),JSON.stringify({data,fetched:new Date().toISOString(),expires,stale:false}));
}
module.exports={seedSupplier};
