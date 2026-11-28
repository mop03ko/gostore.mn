import React, {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Alert, App, Button, Checkbox, ConfigProvider, Descriptions, Drawer, Empty, Grid, Input, Pagination, Select, Space, Spin, Statistic, Table, Tabs, Tag, Timeline} from 'antd';
import {ArrowRightOutlined, CheckCircleOutlined, InboxOutlined, SearchOutlined, ShoppingOutlined, SwapOutlined, WalletOutlined} from '@ant-design/icons';
import './workspace.css';

const tabs=[
  {key:'orders',label:'Захиалгууд',icon:<ShoppingOutlined/>},
  {key:'tasks',label:'Шийдвэрлэх ажил',icon:<CheckCircleOutlined/>},
  {key:'payments',label:'Төлбөр тулгах',icon:<WalletOutlined/>},
  {key:'parcels',label:'Ачааны хэсгүүд',icon:<InboxOutlined/>},
];
const filters={all:'Бүх захиалга',due:'Тээврийн үлдэгдэлтэй',ready:'Олгоход бэлэн',review:'TaoWorld шалгах'};
const tasks={purchase:'Төлбөр орсон · TaoWorld шалгах',parcel:'Зарим хэсэг нь ирээгүй',balance:'Хүлээлгэн өгсөн · үлдэгдэлтэй'};
const colors={completed:'default',cancelled:'red',confirmed:'green',shipping:'blue',erenhot:'geekblue',erenhot_ready:'blue',erenhot_dispatched:'blue',ready_pickup:'green',ready_delivery:'green',quoted:'gold',new:'volcano'};
const money=amount=>Number(amount||0).toLocaleString('en-US')+' ₮';
const date=iso=>iso?new Date(iso).toLocaleString('mn-MN',{timeZone:'Asia/Ulaanbaatar'}):'—';
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
const theme={token:{colorPrimary:'#b7451a',colorText:'#1c2840',colorTextSecondary:'#59677f',colorTextPlaceholder:'#65758f',
  controlHeight:42,borderRadius:10,fontFamily:'Arimo, Arial, sans-serif'}};

function Status({order, labels, canonical=false}){
  const value=canonical?order.status:order.display_status;
  return <Tag color={colors[value]||'default'}>{labels[value]||value}</Tag>;
}
function Balance({order}){
  return order.transport_due?<span className="aw-due"><small>Тээврийн үлдэгдэл</small><strong>{money(order.due)}</strong></span>
    :<span>{order.paid?'Эхний төлбөр баталгаажсан':order.due?'Эхний төлбөр хүлээж буй':'Төлбөрийн үлдэгдэлгүй'}</span>;
}
function Problem({error, retry}){
  return error&&<Alert type="error" showIcon title={error} action={retry&&<Button type="link" onClick={retry}>Дахин оролдох</Button>}/>;
}

function Payment({data, mutate, busy, reload}){
  const [reference,setReference]=useState('');
  const {order,billing}=data;
  const rows=[
    ['Барааны эхний төлбөр',money(order.amount)],
    ['Карго',money(billing.breakdown.cargo_mnt)],
    ['Хүргэлт',money(billing.breakdown.delivery_mnt)],
    ['QPay-аар төлсөн тээвэр',money(data.qpay_paid)],
    ['Гадуур авсан тээврийн төлбөр',money(data.receipts.reduce((sum,receipt)=>sum+receipt.amount,0))],
    ['Буцаалт',money(billing.refunded)],
    ['Төлбөрийн үлдэгдэл',money(billing.due)],
  ];
  return <div className="aw-card">
    <h3>{order.id} · Төлбөрийн задаргаа</h3>
    <Descriptions items={rows.map(([label,children])=>({key:label,label,children}))} column={1} size="small"/>
    {data.qpay_open&&<Button loading={busy} onClick={()=>mutate('admin-workspace-qpay',{id:order.id},reload)}>QPay төлбөр шалгах</Button>}
    {order.transport_due&&!data.qpay_open&&!order.demo&&<form className="aw-form" onSubmit={event=>{
      event.preventDefault();
      event.stopPropagation();
      mutate('admin-order-freight-receipt',{id:order.id,amount:billing.due,reference},reload);
    }}><label>Гүйлгээний лавлагаа<Input required minLength={4} maxLength={64} value={reference} onChange={event=>setReference(event.target.value)}/></label>
      <Button type="primary" htmlType="submit" loading={busy}>Гадуур төлсөн {money(billing.due)} бүртгэх</Button>
    </form>}
    {data.receipts.length>0&&<ul className="aw-records">{data.receipts.map((receipt,i)=><li key={i}>{receipt.reference||'Гадуур төлсөн'} · {money(receipt.amount)} · {date(receipt.recorded_at)}</li>)}</ul>}
  </div>;
}

function Parcels({data, labels, open, mutate, busy, reload}){
  const [selected,setSelected]=useState([]);
  const [reason,setReason]=useState('');
  const [checked,setChecked]=useState(false);
  const [requestKey,setRequestKey]=useState(token);
  const {order,parcel_list}=data;
  const ready=selected.length>0&&selected.length<parcel_list.total&&reason.trim()&&checked;
  return <div className="aw-card">
    <h3>{order.id} · {parcel_list.arrived} / {parcel_list.total} илгээмж ирсэн</h3>
    {data.parent_id&&<Button type="link" onClick={()=>open(data.parent_id)}>Үндсэн захиалга · {data.parent_id}</Button>}
    {data.batch_id&&<Tag color="geekblue">Багц · {data.batch_id}</Tag>}
    {parcel_list.list.map(parcel=><div className="aw-piece" key={parcel.no}>
      <div>{data.can_split&&<Checkbox disabled={!parcel.arrived_at||busy} checked={selected.includes(parcel.no)}
        aria-label={parcel.no+' сонгох'} onChange={event=>{setChecked(false);setSelected(event.target.checked?[...selected,parcel.no]:selected.filter(no=>no!==parcel.no));}}/>}
        <strong>{parcel.no}</strong><small>{parcel.company}</small></div>
      <Tag color={parcel.arrived_at?'green':'gold'}>{parcel.arrived_at?'Ирсэн':'Ирээгүй'}</Tag>
      {!parcel.arrived_at&&data.can_arrive&&<Button size="small" disabled={busy} onClick={()=>mutate('admin-workspace-arrive',{id:order.id,number:parcel.no},reload)}>Ирснээр бүртгэх</Button>}
    </div>)}
    {!parcel_list.total&&<p>Дотоод хүргэлтийн дугаар бүртгэгдээгүй байна.</p>}
    {selected.length>0&&data.can_split&&<form className="aw-form" onSubmit={event=>{
      event.preventDefault();
      event.stopPropagation();
      if(ready)mutate('admin-workspace-split',{id:order.id,numbers:selected,reason,checked,expected_version:data.version,expected_status:order.status,token:requestKey},async result=>{
        setRequestKey(token());await reload();if(result.new_part)open(result.new_part);
      });
    }}>
      <label>Хэсэгчлэн илгээх шалтгаан<Input maxLength={500} value={reason} onChange={event=>{setReason(event.target.value);setChecked(false);}}/></label>
      <Checkbox checked={checked} onChange={event=>setChecked(event.target.checked)}>Илгээх болон үлдэх хэсгийг тулгасан</Checkbox>
      <Button htmlType="submit" type="primary" disabled={!ready} loading={busy}>Ирсэн хэсгийг салгах</Button>
    </form>}
    {data.can_batch&&<Button type="primary" loading={busy} onClick={()=>mutate('admin-workspace-batch',{id:order.id,token:requestKey},reload)}>GB багцад бэлдэх</Button>}
    {data.shipments.length>0&&<ul className="aw-records">{data.shipments.map(part=><li key={part.id}>
      <Button type="link" onClick={()=>open(part.id)}>{part.id}</Button>{labels[part.status]||part.status}{part.batch_id&&' · '+part.batch_id}
    </li>)}</ul>}
  </div>;
}

function Workspace({api, labels, openLegacy}){
  const {message}=App.useApp();const {lg}=Grid.useBreakpoint();
  const [tab,setTab]=useState('orders'),[filter,setFilter]=useState('all'),[branch,setBranch]=useState(),[query,setQuery]=useState(''),[from,setFrom]=useState(''),[to,setTo]=useState(''),[page,setPage]=useState(1);
  const [revision,setRevision]=useState(0),[list,setList]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
  const [id,setId]=useState(''),[orderCode,setOrderCode]=useState(''),[detail,setDetail]=useState(null),[drawer,setDrawer]=useState(false),[detailError,setDetailError]=useState(''),[busy,setBusy]=useState(false);
  const collection=tab==='orders'||tab==='tasks';
  useEffect(()=>{
    if(!collection)return;
    const controller=new AbortController();
    const params=new URLSearchParams({view:tab,page:String(page),filter:filter==='all'?'':filter,branch:branch||'',q:query.trim(),from,to});
    setLoading(true);setError('');
    const timer=setTimeout(()=>api('admin-workspace&'+params,undefined,controller.signal).then(data=>{if(!controller.signal.aborted)setList(data);})
      .catch(error=>{if(!controller.signal.aborted)setError(error.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);}),query?220:0);
    return()=>{controller.abort();clearTimeout(timer);};
  },[api,collection,tab,filter,branch,query,from,to,page,revision]);
  const action=id=>'admin-workspace&id='+encodeURIComponent(id);
  useEffect(()=>{
    if(!id||(!drawer&&collection))return;
    const controller=new AbortController();
    setDetail(null);setDetailError('');
    api(action(id),undefined,controller.signal).then(data=>{if(!controller.signal.aborted)setDetail(data);}).catch(error=>{if(!controller.signal.aborted)setDetailError(error.message);});
    return()=>controller.abort();
  },[api,id,drawer,collection,revision]);
  function refresh(){setRevision(value=>value+1);}
  function navigate(next,newId=''){
    if(next!==tab)setList(null);
    setTab(next);setFilter('all');setPage(1);setDrawer(false);setError('');setDetailError('');
    if(newId){setId(newId);setOrderCode(newId);}
  }
  function showOrder(orderId){setId(orderId);setOrderCode(orderId);if(collection)setDrawer(true);}
  async function mutate(endpoint,payload,after=refresh){
    if(busy)return;
    setBusy(true);setDetailError('');
    try{const response=await api(endpoint,payload);message.success('Шинэчлэгдлээ.');await after(response);}
    catch(error){setDetailError(error.message);}
    finally{setBusy(false);}
  }
  async function legacy(orderId){
    setDrawer(false);setDetailError('');
    try{await openLegacy(orderId);}catch(error){setDetailError(error.message);}
  }
  const listData=list||{rows:[],total:0,size:25,branches:{},staff:[],counts:{}};
  const orderColumns=[
    {key:'id',title:'Захиалга',render:(_,order)=><div><Button type="link" onClick={()=>showOrder(order.id)}>{order.id}</Button><small>{order.title}</small></div>},
    {key:'customer',title:'Хэрэглэгч',render:(_,order)=><>{order.customer}<small>{order.phone}</small></>},
    {dataIndex:'branch',title:'Авах салбар'},
    {key:'status',title:'Ачааны төлөв',render:(_,order)=><Status order={order} labels={labels}/>},
    {key:'payment',title:'Төлбөр',render:(_,order)=><Balance order={order}/>},
    {dataIndex:'amount',title:'Захиалгын дүн',align:'right',render:money},
  ];
  function taskAction(order){
    if(order.task==='purchase')legacy(order.id);
    else navigate(order.task==='balance'?'payments':'parcels',order.id);
  }
  const taskCards=tab==='tasks'&&<div className="aw-cards">{listData.rows.map(order=><article key={order.id+':'+order.task} className="aw-card aw-task">
    <div><Tag>{tasks[order.task]}</Tag><h3>{order.id} · {order.title}</h3><small>{order.branch} · {date(order.since)}</small>
      {order.task==='parcel'&&<p>{order.arrived} / {order.pieces} илгээмж ирсэн</p>}{order.task==='balance'&&<Balance order={order}/>}</div>
    <Select aria-label={order.id+' хариуцагч'} placeholder="Хариуцагч" virtual={false} allowClear value={order.assignee||undefined}
      options={listData.staff.map(person=>({value:person.id,label:person.name}))} disabled={busy}
      onChange={assignee=>mutate('admin-workspace-assign',{id:order.id,task:order.task,assignee:assignee||''})}/>
    <Button icon={<ArrowRightOutlined/>} onClick={()=>taskAction(order)}>{order.task==='purchase'?'TaoWorld нээх':order.task==='balance'?'Төлбөр тулгах':'Хэсгүүдийг харах'}</Button>
  </article>)}</div>;
  const detailPane=detail&&detail.order.id===id?detail:null;
  return <>
    <div className="aw-heading"><div><h2>Захиалгын ажлын хэсэг</h2><p>Салбар, захиалгын явц, төлбөрийн тулгалт</p></div><Button onClick={refresh}>Шинэчлэх</Button></div>
    <div className="aw-navigation" role="navigation" aria-label="Захиалгын ажлын хэсгийн цэс">
      {tabs.map(({key,label,icon})=><Button key={key} type={tab===key?'primary':'default'} icon={icon}
        aria-label={label} aria-pressed={tab===key} onClick={()=>navigate(key)}>{label}</Button>)}
    </div>
    {collection?<>
      {tab==='orders'&&<div className="aw-metrics">{Object.entries(filters).map(([key,label])=><button key={key} type="button" aria-pressed={filter===key}
        onClick={()=>{setFilter(key);setPage(1);}}><Statistic title={label} value={listData.counts[key]??'—'}/></button>)}</div>}
      <div className="aw-toolbar">
        <Input aria-label="Захиалга хайх" prefix={<SearchOutlined/>} placeholder="GS код, нэр, утсаар хайх" value={query} allowClear onChange={event=>{setQuery(event.target.value);setPage(1);}}/>
        <Select aria-label="Авах салбар" placeholder="Бүх салбар" virtual={false} allowClear value={branch} options={Object.entries(listData.branches).map(([value,label])=>({value,label}))} onChange={value=>{setBranch(value);setPage(1);}}/>
        {tab==='tasks'&&<Select aria-label="Ажлын төрлөөр шүүх" value={filter} virtual={false} options={[{value:'all',label:'Бүх төрлийн ажил'},...Object.entries(tasks).map(([value,label])=>({value,label}))]}
          onChange={value=>{setFilter(value);setPage(1);}}/>}
        <Input type="date" aria-label="Эхлэх огноо" value={from} onChange={event=>{setFrom(event.target.value);setPage(1);}}/>
        <Input type="date" aria-label="Дуусах огноо" value={to} onChange={event=>{setTo(event.target.value);setPage(1);}}/>
      </div>
      <Problem error={error} retry={refresh}/>{!drawer&&<Problem error={detailError}/>}
      <Spin spinning={loading}>
        {tab==='orders'&&(lg?<Table className="aw-table" rowKey="id" dataSource={listData.rows} columns={orderColumns} pagination={false} locale={{emptyText:'Захиалга олдсонгүй'}}/>
          :<div className="aw-cards">{listData.rows.map(order=><article key={order.id} className="aw-card aw-mobile-order">
            <div><Button type="link" onClick={()=>showOrder(order.id)}>{order.id}</Button><Status order={order} labels={labels}/></div>
            <h3>{order.title}</h3><div><span>{order.branch}</span><strong>{money(order.amount)}</strong></div><Balance order={order}/>
          </article>)}</div>)}
        {taskCards}
        {listData.rows.length===0&&(!lg||tab==='tasks')&&!loading&&<Empty description="Тохирох бүртгэл олдсонгүй"/>}
      </Spin>
      <Pagination className="aw-pager" current={page} onChange={setPage} pageSize={listData.size} total={listData.total} showSizeChanger={false}/>
    </>:<>
      <form className="aw-lookup" onSubmit={event=>{event.preventDefault();event.stopPropagation();const requested=orderCode.trim().toUpperCase();if(requested===id)refresh();else showOrder(requested);}}>
        <Input aria-label="Захиалгын GS код" placeholder="GS код оруулах" value={orderCode} onChange={event=>setOrderCode(event.target.value)} required maxLength={50}/>
        <Button type="primary" htmlType="submit">Захиалга нээх</Button>
      </form>
      <Problem error={detailError}/>
      {!id?<Empty description="Захиалгын GS код оруулна уу"/>:!detailPane&&!detailError?<Spin/>:detailPane&&(tab==='payments'
        ?<Payment key={id} data={detailPane} mutate={mutate} busy={busy} reload={refresh}/>
        :<Parcels key={id+':'+detailPane.version} data={detailPane} labels={labels} open={showOrder} mutate={mutate} busy={busy} reload={refresh}/>)}
    </>}
    <Drawer className="workspace-drawer" open={drawer} title={id} onClose={()=>setDrawer(false)} destroyOnHidden size={lg?496:'100%'}>
      <Problem error={detailError} retry={refresh}/>
      {detailPane?<><div className="aw-drawer-summary">
        <div><small>Ачааны төлөв</small><Status order={detailPane.order} labels={labels}/></div>
        <div><small>Авах салбар</small><strong>{detailPane.order.branch}</strong></div>
        <div><small>Төлбөрийн үлдэгдэл</small><strong>{money(detailPane.billing.due)}</strong></div>
      </div>
      {detailPane.order.display_status!==detailPane.order.status&&<p>Агуулахын бүртгэл <Status order={detailPane.order} labels={labels} canonical/></p>}
      <Tabs items={[
        {key:'info',label:'Тойм',children:<Descriptions column={1} size="small" items={[
          ['Захиалга',detailPane.order.title],['Хэрэглэгч',detailPane.order.customer],['Утас',detailPane.order.phone],['Огноо',date(detailPane.order.created)],
        ].map(([label,children])=>({key:label,label,children}))}/>},
        {key:'history',label:'Тээврийн явц',children:<Timeline items={[...detailPane.history].reverse().map(event=>({children:<>{labels[event.status]||event.event||event.status} · {date(event.at)}</>}))}/>},
        {key:'payment',label:'Төлбөр',children:<Payment key={id} data={detailPane} mutate={mutate} busy={busy} reload={refresh}/>},
      ]}/>
      <div className="aw-form"><Select aria-label="Төлөв шууд засах" virtual={false} placeholder="Төлөв шууд засах" disabled={busy}
        options={Object.entries(labels).filter(([value])=>value!==detailPane.order.display_status).map(([value,label])=>({value,label}))}
        onChange={status=>mutate('admin-order-status-save',{id,status,expected_status:detailPane.order.display_status})}/></div>
      <Space wrap><Button onClick={()=>navigate('parcels',id)}>Ачааны хэсгүүд</Button><Button type="primary" onClick={()=>legacy(id)}>Захиалгын бүх үйлдэл</Button></Space>
      </>:!detailError&&<Spin/>}
    </Drawer>
  </>;
}

export function mountWorkspace(element, bridge){
  const root=createRoot(element);
  root.render(<ConfigProvider theme={theme}><App><Workspace {...bridge}/></App></ConfigProvider>);
  return ()=>root.unmount();
}
