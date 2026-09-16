import { nyWeekId, weekLabel } from './week.ts'

// Reference ISO week numbers computed independently (UTC, no NY shift) so we
// can confirm the week algorithm itself, then check the NY boundary separately.
function isoRef(y:number,m:number,d:number){
  const dt=new Date(Date.UTC(y,m-1,d))
  const day=(dt.getUTCDay()+6)%7
  const th=new Date(dt); th.setUTCDate(dt.getUTCDate()-day+3)
  const iy=th.getUTCFullYear()
  const j4=new Date(Date.UTC(iy,0,4)); const j4d=(j4.getUTCDay()+6)%7
  const w1=new Date(j4); w1.setUTCDate(j4.getUTCDate()-j4d+3)
  return `${iy}-W${String(Math.round((+th-+w1)/(7*86400000))+1).padStart(2,'0')}`
}

let fail=0
const chk=(got:string,want:string,label:string)=>{
  const ok=got===want; if(!ok)fail++
  console.log(`${ok?'ok  ':'FAIL'}  ${label}: got ${got} want ${want}`)
}

// Known ISO anchors
chk(isoRef(2026,1,1),'2026-W01','2026-01-01 is W01')
chk(isoRef(2026,12,31),'2026-W53','2026-12-31 is a Thursday -> 2026-W53')
chk(isoRef(2027,1,3),'2026-W53','2027-01-03 still belongs to 2026-W53')
chk(isoRef(2027,1,4),'2027-W01','2027-01-04 is W01')

// Midday NY, far from the boundary -> must match the plain ISO week.
for (const [y,m,d] of [[2026,9,16],[2026,1,1],[2026,12,31],[2027,3,15],[2026,6,30]] as const) {
  const noon = new Date(Date.UTC(y,m-1,d,16,0,0)) // 12:00 NY (EDT) / 11:00 EST
  chk(nyWeekId(noon), isoRef(y,m,d), `${y}-${m}-${d} noon NY`)
}

// The Monday 04:00 NY boundary. 2026-09-14 is a Monday.
// 03:59 NY (EDT = UTC-4) => 07:59 UTC -> still previous week.
chk(nyWeekId(new Date('2026-09-14T07:59:00Z')), '2026-W37', 'Mon 03:59 NY = previous week')
chk(nyWeekId(new Date('2026-09-14T08:01:00Z')), '2026-W38', 'Mon 04:01 NY = new week')

// DST: 2026-11-01 fall back (EDT->EST). Monday 2026-11-02 boundary is 09:00 UTC (EST=UTC-5).
chk(nyWeekId(new Date('2026-11-02T08:59:00Z')), '2026-W44', 'EST Mon 03:59 NY = previous week')
chk(nyWeekId(new Date('2026-11-02T09:01:00Z')), '2026-W45', 'EST Mon 04:01 NY = new week')

// DST: 2027-03-14 spring forward (EST->EDT). Monday 2027-03-15 boundary is 08:00 UTC (EDT=UTC-4).
chk(nyWeekId(new Date('2027-03-15T07:59:00Z')), '2027-W10', 'EDT Mon 03:59 NY = previous week')
chk(nyWeekId(new Date('2027-03-15T08:01:00Z')), '2027-W11', 'EDT Mon 04:01 NY = new week')

// Exactly one rollover across a full DST-crossing week, sampled hourly.
let flips=0, prev=nyWeekId(new Date('2026-10-30T00:00:00Z'))
for(let h=1;h<=24*7;h++){
  const id=nyWeekId(new Date(Date.UTC(2026,9,30,h)))
  if(id!==prev){flips++;prev=id}
}
chk(String(flips),'1','exactly one rollover across the fall-back week')

console.log(weekLabel('2026-W38'), '|', weekLabel('2027-W01'))
process.exit(fail?1:0)
