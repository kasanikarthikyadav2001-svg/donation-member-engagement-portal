import {useEffect,useState} from 'react';
import {Link,useParams} from 'react-router-dom';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {FlaskConical,CheckCircle2,XCircle,ArrowLeft,Download,CreditCard,LockKeyhole,HeartHandshake,ArrowRight,Check,ShieldCheck} from 'lucide-react';
import {api,send,downloadReceipt} from '../services/api';
import {money} from '../utils/format';
import {Button,Skeleton,ErrorState,Field} from '../components/ui';
import {TEST_CARDS,formatTestCard,formatExpiry,demoExpiry,validateDemoCard,type CardErrors,type DemoCardFields} from '../utils/demoCard';

type Outcome='succeeded'|'failed'|'cancelled';
const emptyCard:DemoCardFields={name:'',number:'',expiry:'',cvc:''};
export function DummyCheckout(){
 const {id}=useParams();const client=useQueryClient();
 const [card,setCard]=useState<DemoCardFields>(emptyCard);
 const [errors,setErrors]=useState<CardErrors>({});
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const key=['dummy-checkout',id];
 const q=useQuery({queryKey:key,queryFn:()=>api(`/donations/${id}/checkout`),retry:false});
 useEffect(()=>{if(q.data?.status!=='pending')setCard(emptyCard);},[q.data?.status]);
 if(q.isLoading)return <Skeleton/>;
 if(q.error)return <ErrorState error={q.error} retry={()=>q.refetch()}/>;
 const d=q.data,complete=d.status!=='pending',success=d.status==='succeeded';
 function update(field:keyof DemoCardFields,value:string){setCard(current=>({...current,[field]:value}));setErrors(current=>({...current,[field]:undefined}));setError('');}
 function useTestCard(index:number){setCard({name:'Test Supporter',number:formatTestCard(TEST_CARDS[index].number),expiry:demoExpiry(),cvc:'123'});setErrors({});setError('');}
 async function finish(next:Outcome){
  if(busy)return;setBusy(true);setError('');
  try{
   // Only the simulated outcome crosses the network. Never transmit card fields.
   const result=await send(`/donations/${id}/checkout`,{outcome:next});
   setCard(emptyCard);client.setQueryData(key,result);
   await client.invalidateQueries({predicate:query=>query.queryKey[0]!=='dummy-checkout'});
  }catch(e){setError((e as Error).message);await q.refetch();}
  finally{setBusy(false);}
 }
 function pay(){const result=validateDemoCard(card);setErrors(result.errors);if(result.outcome)void finish(result.outcome);}
 return <div className="payment-checkout">
  <div className="payment-topline"><Link to="/donations"><ArrowLeft size={17}/>Back to donations</Link><span className="payment-test-badge"><FlaskConical size={14}/>Test mode</span></div>
  <div className="payment-heading"><span className="eyebrow">BEACON COMMUNITY</span><h1>Complete your contribution</h1><p>Your support brings our community closer together.</p></div>
  <div className="payment-layout">
   <aside className="payment-order" aria-label="Contribution summary">
    <div className="payment-impact"><span className="payment-impact-icon"><HeartHandshake size={29}/></span><p>A little support.<br/><strong>A lasting difference.</strong></p><span>Supporting people. Connecting communities.</span></div>
    <div className="payment-order-body"><span className="eyebrow">YOUR CONTRIBUTION</span><h2>{money(d.amount_cents)} <small>AUD</small></h2><p>{d.campaign}</p>
     <dl><div><dt>Supporter</dt><dd>{d.donor_name}</dd></div><div><dt>Contribution</dt><dd>{money(d.amount_cents)}</dd></div><div><dt>Processing fee</dt><dd>{money(0)}</dd></div><div className="payment-total"><dt>Total today</dt><dd>{money(d.amount_cents)} AUD</dd></div></dl>
     <div className="payment-order-note"><ShieldCheck size={18}/><span>Test contribution only. No money is collected, and fundraising totals are unchanged.</span></div>
    </div>
   </aside>
   <section className="payment-details">
    <ol className="payment-steps" aria-label="Checkout progress"><li className="active"><span>{complete?<Check size={13}/>:1}</span>Payment details</li><li className={complete?'active':''}><span>2</span>Confirmation</li></ol>
    {complete?<div className={`payment-result ${success?'success':'unsuccessful'}`} role="status">
     <div className="payment-result-icon">{success?<CheckCircle2 size={39}/>:<XCircle size={39}/>}</div>
     <span className="payment-test-badge">TEST TRANSACTION</span>
     <h2>{success?'Thank you for your support':d.status==='failed'?'Your test payment was declined':'Checkout cancelled'}</h2>
     <p>{success?'Your test contribution has been recorded and your simulation receipt is ready. No funds were collected.':d.status==='failed'?'This test card was declined as expected. No funds were collected and no success receipt was issued.':'No funds were collected and no success receipt was issued.'}</p>
     <div className="payment-confirmation"><div><span>Amount</span><strong>{money(d.amount_cents)} AUD</strong></div><div><span>Result</span><strong>{success?'Test payment successful':d.status==='failed'?'Test payment declined':'Cancelled'}</strong></div>{d.reference&&<div><span>Receipt reference</span><strong>{d.reference}</strong></div>}</div>
     {error&&<p className="form-error" role="alert">{error}</p>}
     {d.receipt_id&&<Button onClick={()=>downloadReceipt(d.receipt_id)}><Download size={17}/>Download test receipt</Button>}
     <Link className={`btn ${success?'btn-secondary':'btn-primary'}`} to={success?'/donations':'/donations?new=1'}>{success?'Return to donations':'Try a new test payment'}<ArrowRight size={16}/></Link>
    </div>:<form className="payment-form" onSubmit={e=>{e.preventDefault();pay();}} noValidate autoComplete="off">
     <div className="payment-form-heading"><div><h2>Payment details</h2><p>Enter the supplied test-card details below.</p></div><div className="payment-card-mark" aria-label="Card payment"><CreditCard size={23}/></div></div>
     <div className="payment-test-tools"><div><FlaskConical size={16}/><strong>Use a test card</strong><span>No real card details.</span></div><div className="payment-preset-buttons">{TEST_CARDS.map((test,i)=><button type="button" key={test.number} disabled={busy} onClick={()=>useTestCard(i)}><span>{test.short}</span><small>•••• {test.number.slice(-4)}</small></button>)}</div></div>
     <fieldset disabled={busy} className="payment-fields"><legend className="sr-only">Test card details</legend>
      <Field label="Name on test card" error={errors.name}><input value={card.name} onChange={e=>update('name',e.target.value)} placeholder="Test Supporter" maxLength={100} autoComplete="off"/></Field>
      <Field label="Test card number" error={errors.number}><input className="payment-icon-input" inputMode="numeric" value={card.number} onChange={e=>update('number',formatTestCard(e.target.value))} placeholder="4242 4242 4242 4242" maxLength={19} autoComplete="off" spellCheck={false}/><CreditCard className="payment-field-icon" size={19} aria-hidden="true"/></Field>
      <div className="payment-card-row"><Field label="Expiry date" error={errors.expiry}><input inputMode="numeric" value={card.expiry} onChange={e=>update('expiry',formatExpiry(e.target.value))} placeholder="MM/YY" maxLength={5} autoComplete="off"/></Field><Field label="Security code" error={errors.cvc}><input className="payment-icon-input" inputMode="numeric" value={card.cvc} onChange={e=>update('cvc',e.target.value.replace(/\D/g,'').slice(0,3))} placeholder="123" maxLength={3} type="password" autoComplete="off"/><LockKeyhole className="payment-field-icon" size={17} aria-hidden="true"/></Field></div>
     </fieldset>
     <p className="payment-card-help">Use a supplied test number, a future expiry and security code <strong>123</strong>. Only recognised test cards are accepted. These fields stay in your browser.</p>
     {error&&<p className="form-error" role="alert">{error}</p>}
     <Button className="payment-submit" loading={busy} type="submit">{busy?'Processing test payment…':`Pay ${money(d.amount_cents)} AUD`}<ArrowRight size={18}/></Button>
     <p className="payment-submit-note"><FlaskConical size={14}/>Test mode · no real charge will be made</p>
     <button className="payment-cancel" type="button" disabled={busy} onClick={()=>void finish('cancelled')}>Cancel and return</button>
    </form>}
    <div className="payment-footer-note"><LockKeyhole size={15}/><span>Demonstration checkout · card details are never sent to our server</span></div>
   </section>
  </div>
 </div>;
}
