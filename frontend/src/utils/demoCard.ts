export const TEST_CARDS = [
  {number:'4242424242424242',label:'Successful payment',short:'Success',outcome:'succeeded'},
  {number:'4000000000000002',label:'Declined payment',short:'Decline',outcome:'failed'},
] as const;
export type DemoCardFields = {name:string;number:string;expiry:string;cvc:string};
export type CardErrors = Partial<Record<keyof DemoCardFields,string>>;
export function formatTestCard(value:string){return value.replace(/\D/g,'').slice(0,16).replace(/(.{4})/g,'$1 ').trim();}
export function formatExpiry(value:string){const v=value.replace(/\D/g,'').slice(0,4);return v.length>2?v.slice(0,2)+'/'+v.slice(2):v;}
export function demoExpiry(now=new Date()){return '12/'+String((now.getUTCFullYear()+3)%100).padStart(2,'0');}
export function validateDemoCard(fields:DemoCardFields,now=new Date()){
 const errors:CardErrors={};
 if(fields.name.trim().length<2||fields.name.trim().length>100)errors.name='Enter a test cardholder name (2–100 characters).';
 const card=TEST_CARDS.find(c=>c.number===fields.number.replace(/[\s-]/g,''));
 if(!card)errors.number='Use a supplied test card. Real card numbers are not accepted.';
 const match=/^(0[1-9]|1[0-2])\/(\d{2})$/.exec(fields.expiry);
 if(!match)errors.expiry='Enter a valid expiry as MM/YY.';
 else {const year=2000+Number(match[2]),month=Number(match[1]);if(Date.UTC(year,month,1)<=now.getTime())errors.expiry='Use a future test expiry date.';else if(year>now.getUTCFullYear()+20)errors.expiry='Use a test expiry within the next 20 years.';}
 if(fields.cvc!=='123')errors.cvc='Use the test security code 123.';
 return {errors,outcome:Object.keys(errors).length?null:card!.outcome};
}
