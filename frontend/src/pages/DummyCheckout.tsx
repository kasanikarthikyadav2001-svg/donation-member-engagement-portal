import {useState} from 'react';
import {Link,useParams} from 'react-router-dom';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {FlaskConical,CheckCircle2,XCircle,ArrowLeft,Download} from 'lucide-react';
import {api,send,downloadReceipt} from '../services/api';
import {money} from '../utils/format';
import {PageHeader,Button,Skeleton,ErrorState} from '../components/ui';

type Outcome='succeeded'|'failed'|'cancelled';
export function DummyCheckout(){
 const {id}=useParams();const client=useQueryClient();
 const [outcome,setOutcome]=useState<Outcome>('succeeded');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const key=['dummy-checkout',id];
 const q=useQuery({queryKey:key,queryFn:()=>api(`/donations/${id}/checkout`),retry:false});
 if(q.isLoading)return <Skeleton/>;
 if(q.error)return <ErrorState error={q.error} retry={()=>q.refetch()}/>;
 const d=q.data,complete=d.status!=='pending';
 async function finish(next:Outcome){
  if(busy)return;setBusy(true);setError('');
  try{const result=await send(`/donations/${id}/checkout`,{outcome:next});client.setQueryData(key,result);await client.invalidateQueries({predicate:query=>query.queryKey[0]!=='dummy-checkout'});}
  catch(e){setError((e as Error).message);await q.refetch();}
  finally{setBusy(false);}
 }
 return <>
  <PageHeader eyebrow="DEMONSTRATION GATEWAY" title="Dummy checkout" description="Explore the payment flow without collecting money or entering real card details."/>
  <div className="sandbox-banner dummy-notice"><FlaskConical size={20}/><span>Simulation only. This checkout does not contact a bank or payment provider.</span></div>
  <div className="dummy-grid">
   <section className="card dummy-summary">
    <span className="eyebrow">YOUR DEMO CONTRIBUTION</span><h2>{money(d.amount_cents)}</h2><p className="muted">AUD · no funds collected</p>
    <dl><div><dt>Initiative</dt><dd>{d.campaign}</dd></div><div><dt>Supporter</dt><dd>{d.donor_name}</dd></div><div><dt>Gateway</dt><dd>Dummy simulation</dd></div><div><dt>Status</dt><dd>{d.status==='pending'?'Awaiting simulation':d.status==='succeeded'?'Simulated success':d.status==='failed'?'Simulated decline':'Cancelled simulation'}</dd></div></dl>
    <p className="muted">Demo activity is saved to your donation history, but never increases fundraising totals.</p>
   </section>
   <section className="card dummy-panel">
    {complete?<div className="dummy-result" role="status">
     {d.status==='succeeded'?<CheckCircle2 size={42}/>:<XCircle size={42}/>}
     <h2>{d.status==='succeeded'?'Dummy payment successful':d.status==='failed'?'Dummy payment declined':'Dummy checkout cancelled'}</h2>
     <p>{d.status==='succeeded'?'Your simulated donation is saved. Its acknowledgement is marked as a simulation; no money was collected.':'No money was collected and no success receipt was issued. Start a new demo donation to try another outcome.'}</p>
     {d.receipt_id&&<Button onClick={()=>downloadReceipt(d.receipt_id)}><Download size={17}/>Download simulation receipt</Button>}
     <Link className="btn btn-secondary" to="/donations">Return to donations</Link>
    </div>:<form onSubmit={e=>{e.preventDefault();void finish(outcome);}}>
     <h2>Choose a test outcome</h2><p className="muted">No card number, expiry date or security code is needed.</p>
     <fieldset className="dummy-choices" disabled={busy}><legend className="sr-only">Payment simulation outcome</legend>
      {([
       ['succeeded','Successful payment','Save one simulated donation and issue a labelled PDF acknowledgement.'],
       ['failed','Declined payment','Save a failed result without issuing a receipt.'],
       ['cancelled','Cancelled checkout','Save a cancelled result without issuing a receipt.'],
      ] as const).map(([value,label,description])=><label className={`dummy-choice ${outcome===value?'selected':''}`} key={value}>
       <input type="radio" name="outcome" value={value} checked={outcome===value} onChange={()=>setOutcome(value)}/><span><strong>{label}</strong><small>{description}</small></span>
      </label>)}
     </fieldset>
     {error&&<p role="alert" className="form-error">{error}</p>}
     <div className="dummy-actions"><Button type="submit" loading={busy}>Simulate payment</Button><Button variant="secondary" type="button" disabled={busy} onClick={()=>void finish('cancelled')}>Cancel checkout</Button></div>
    </form>}
   </section>
  </div>
  <Link className="dummy-back" to="/donations"><ArrowLeft size={16}/>Back to donation history</Link>
 </>;
}
