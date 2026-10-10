from pathlib import Path
import json, math, html
from datetime import datetime
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, Color, white
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from pypdf import PdfReader

ROOT=Path(__file__).resolve().parents[2]
DATA=json.loads((ROOT/'tmp/pdfs/report_metrics.json').read_text())
OUT=ROOT/'output/pdf/CommodityLens_Validation_Report.pdf'
OUT.parent.mkdir(parents=True,exist_ok=True)
for name,file in [('Sans','calibri.ttf'),('Medium','calibrib.ttf'),('Serif','georgia.ttf'),('SerifItalic','georgiai.ttf'),('Mono','consola.ttf')]:
    pdfmetrics.registerFont(TTFont(name,str(Path('C:/Windows/Fonts')/file)))
pdfmetrics.registerFontFamily('Sans',normal='Sans',bold='Medium',italic='Sans',boldItalic='Medium')
W,H=595.276,841.89
M=44; CW=W-2*M
INK=HexColor('#142C39'); MUTED=HexColor('#62717A'); GOLD=HexColor('#A58239'); PALE=HexColor('#F4F0E5'); PAPER=HexColor('#FCFBF8'); BORDER=HexColor('#DBDFDF'); GREEN=HexColor('#286A58'); BLUE=HexColor('#527487'); RED=HexColor('#9E5861'); SOFTGREEN=HexColor('#EAF2ED')
c=canvas.Canvas(str(OUT),pagesize=(W,H),pageCompression=1)
c.setTitle('CommodityLens | Validation Report')
c.setAuthor('CommodityLens - Engineering Validation')
c.setSubject('Seven-page internal validation report: metrics, architecture, analytics and release gates')
c.setCreator('CommodityLens report generation')

def rect(x,y,w,h,fill=white,stroke=None,r=0):
    c.setFillColor(fill)
    c.setStrokeColor(stroke or fill)
    if r: c.roundRect(x,H-y-h,w,h,r,stroke=bool(stroke),fill=1)
    else: c.rect(x,H-y-h,w,h,stroke=bool(stroke),fill=1)

def line(x1,y1,x2,y2,color=BORDER,width=.6,dash=None):
    c.setStrokeColor(color);c.setLineWidth(width);c.setDash(dash or [])
    c.line(x1,H-y1,x2,H-y2);c.setDash([])

def text(s,x,y,size=10,font='Sans',color=INK,align='left'):
    c.setFont(font,size);c.setFillColor(color)
    f=c.drawString if align=='left' else c.drawRightString if align=='right' else c.drawCentredString
    f(x,H-y-size*.82,str(s))

def para(s,x,y,w,size=10,color=INK,font='Sans',leading=None,align=TA_LEFT):
    style=ParagraphStyle('p',fontName=font,fontSize=size,leading=leading or size*1.4,textColor=color,alignment=align,spaceAfter=0)
    p=Paragraph(html.escape(s),style);_,h=p.wrap(w,800);p.drawOn(c,x,H-y-h)
    return h

def label(s,x,y,color=MUTED,size=7.6):
    text(s.upper(),x,y,size,'Medium',color)

def pill(s,x,y,color=GREEN,fill=SOFTGREEN,size=7.5):
    width=pdfmetrics.stringWidth(s,'Medium',size)+18
    rect(x,y,width,20,fill,r=3);text(s,x+9,y+6,size,'Medium',color)
    return width

def arrow(x1,y1,x2,y2,color=GOLD):
    line(x1,y1,x2,y2,color,.9)
    angle=math.atan2(y2-y1,x2-x1);length=4
    for da in [-.48,.48]: line(x2,y2,x2-length*math.cos(angle+da),y2-length*math.sin(angle+da),color,.9)

def circle(x,y,r,stroke=GOLD,fill=None,width=1):
    c.setStrokeColor(stroke);c.setLineWidth(width)
    if fill: c.setFillColor(fill)
    c.circle(x,H-y,r,stroke=1,fill=bool(fill))

def logo(x,y):
    circle(x+12,y+12,10,fill=None,width=1.4);circle(x+12,y+12,5.7,width=.65)
    line(x+20,y+20,x+25,y+25,GOLD,1.2)
    text('CommodityLens',x+34,y+4,13,'Medium',INK)

def page(number,section,title=None,deck=None):
    rect(0,0,W,H,PAPER)
    logo(M,29)
    text('VALIDATION REPORT',W-M,38,7.1,'Medium',MUTED,'right')
    line(M,73,W-M,73)
    label(f'{number:02d} / {section}',M,95,color=GOLD)
    if title:text(title,M,116,29,'Serif')
    if deck:para(deck,M,158,CW,10.2,MUTED,leading=14)
    line(M,800,W-M,800)
    text('COMMODITYLENS  /  INTERNAL ENGINEERING VALIDATION',M,814,6.8,'Medium',MUTED)
    text(f'{number:02d} / 07',W-M,812,9,'Mono',GOLD,'right')

def foot(s):para(s,M,770,CW,7.3,MUTED,leading=9.3)

def metric(x,y,w,value,name,note=None,color=INK,size=25):
    label(name,x,y,color=MUTED,size=7.2)
    text(value,x,y+22,size,'Mono',color)
    if note:para(note,x,y+size+32,w,8.1,MUTED,leading=10.5)

def rule_title(s,x,y,w):
    label(s,x,y,color=GOLD);line(x,y+18,x+w,y+18)

def box(x,y,w,h,title,body,num=None,fill=white):
    rect(x,y,w,h,fill,BORDER,r=5)
    if num:label(num,x+13,y+13,GOLD,7.1)
    para(title,x+13,y+(29 if num else 13),w-26,11.5,INK,'Medium',14)
    para(body,x+13,y+(51 if num else 36),w-26,8.4,MUTED,leading=11)

def chart_axes(x,y,w,h,ymin,ymax,yticks=4,suffix='',dates=None):
    # x/y describe the actual plotting rectangle, using top-origin page coordinates.
    for i in range(yticks+1):
        value=ymin+(ymax-ymin)*i/yticks
        yy=y+h-(value-ymin)/(ymax-ymin)*h
        line(x,yy,x+w,yy,BORDER,.45)
        text(f'{value:.0f}{suffix}',x-8,yy-3.4,7.3,'Mono',MUTED,'right')
    if ymin<0<ymax:
        yy=y+h-(0-ymin)/(ymax-ymin)*h;line(x,yy,x+w,yy,MUTED,.7,dash=[2,2])
    if dates:
        for fraction in [0,.25,.5,.75,1]:
            index=round((len(dates)-1)*fraction)
            stamp=datetime.fromisoformat(dates[index]).strftime('%d %b')
            text(stamp,x+w*fraction,y+h+12,7.5,'Sans',MUTED,'center')
    return lambda i,v,n:(x+i/(n-1)*w,y+h-(v-ymin)/(ymax-ymin)*h)

def series(values,xy,color=GOLD,width=1.5,dash=None):
    c.setStrokeColor(color);c.setLineWidth(width);c.setDash(dash or [])
    path=c.beginPath();connected=False
    for i,v in enumerate(values):
        if v is None:connected=False;continue
        xx,yy=xy(i,v,len(values))
        if not connected:path.moveTo(xx,H-yy);connected=True
        else:path.lineTo(xx,H-yy)
    c.drawPath(path);c.setDash([])

def band(lower,upper,xy,fill=PALE):
    indexes=[i for i,v in enumerate(lower) if v is not None and upper[i] is not None]
    if not indexes:return
    path=c.beginPath()
    coords=[xy(i,upper[i],len(lower)) for i in indexes]+[xy(i,lower[i],len(lower)) for i in reversed(indexes)]
    path.moveTo(coords[0][0],H-coords[0][1])
    for xx,yy in coords[1:]:path.lineTo(xx,H-yy)
    path.close();c.setFillColor(fill);c.drawPath(path,stroke=0,fill=1)

def legend(items,x,y):
    for name,color,dash in items:
        line(x,y+5,x+16,y+5,color,1.5,dash)
        text(name,x+22,y,7.7,'Sans',MUTED)
        x+=pdfmetrics.stringWidth(name,'Sans',7.7)+45

def number(v,n=2):return f'{v:,.{n}f}'

# 01 / Executive synthesis
page(1,'Executive assessment')
label('COMMODITYLENS / RELEASE 1.0',M,133,color=MUTED,size=8)
text('Clarity, tested.',M,163,43,'Serif')
text('A validation report.',M,219,31,'SerifItalic',GOLD)
para('A disciplined assessment of the gold intelligence platform: what works locally, what the analytical evidence shows, and what must still be verified before production.',M,277,425,11.2,MUTED,leading=16)
pill('LOCAL VALIDATION PASSED',M,348)
text('Production acceptance remains open.',M+181,355,8.8,'Sans',MUTED)
line(M,390,W-M,390)
for i,(v,n,note) in enumerate([('37','BACKEND TESTS','Financial invariants, API and ingestion'),('9','BROWSER CHECKS','Includes two accessibility scenarios'),('0','AUDIT FINDINGS','Reported frontend dependency vulnerabilities'),('13,144','SAMPLE ROWS','Synthetic fixtures; not market data')]):
    x=M+i*(CW/4)
    metric(x,414,CW/4-15,v,n,note,size=24)
    if i<3:line(x+CW/4-12,414,x+CW/4-12,512)
rect(M,549,CW,169,PALE,r=5)
label('ASSESSMENT',M+20,568,GOLD)
para('Ready for a controlled staging review.',M+20,591,CW-40,21,INK,'Serif',27)
para('The application, calculations and core user flows are supported by local verification. The evidence does not yet establish a production deployment, an accepted live-data feed, or an executable trading edge.',M+20,634,CW-40,10.1,MUTED,leading=14)
text('10 OCTOBER 2026',M,740,8,'Medium',INK)
text('Prepared from repository evidence and reproducible sample analytics',W-M,740,7.5,'Sans',MUTED,'right')
foot('Scope: internal engineering validation, not an independent audit or investment recommendation. The report contains exactly seven pages; sources and release gates appear on page 7.')
c.showPage()

# 02 / Architecture and nine-step flow
page(2,'System architecture','From source to decision.','Separate data origins. Explicit transformations. One traceable research workspace.')
box(M,202,238,66,'Authorized Bhavcopy CSV','Explicit header mapping, validation and atomic import.',fill=white)
box(M+269,202,238,66,'Deterministic sample fixtures','Fixed-seed, clearly labeled research observations.',fill=PALE)
arrow(M+119,269,M+119,293);arrow(M+388,269,M+388,293)
rect(M,293,CW,60,white,BORDER,r=5)
label('DATA STORE + SOURCE SELECTION',M+15,306,GOLD)
para('PostgreSQL in deployment; SQLite for local development. Imported and sample rows are isolated. DATA_MODE selects one source; there is no silent fallback.',M+15,324,CW-30,8.8,MUTED,leading=11.5)
arrow(M+119,354,M+119,386)
text('contracts.yaml supplies units, purity and verification flags',M+134,367,7.3,'Sans',MUTED)
box(M,386,238,67,'Analytics engine','Normalization, alignment, signals, costs and walk-forward replay.')
box(M+269,386,238,67,'Typed FastAPI service','Validated requests, response schemas and OpenAPI documentation.')
arrow(M+239,419,M+268,419)
arrow(M+388,454,M+388,479)
rect(M,479,CW,49,INK,r=5)
text('REACT RESEARCH WORKSPACE',M+15,491,8,'Medium',white)
text('Eight views  /  Light + dark themes  /  URL filters  /  CSV + PNG exports',M+15,510,9,'Sans',HexColor('#DCE5E8'))
rule_title('Nine-step research flow',M,553,CW)
stages=[('01 - 03','PREPARE',['Bhavcopy ingestion','Cleaning & validation','Contract identification']),('04 - 06','ANALYZE',['Fine-gold normalization','Cross-contract comparison','Signal generation']),('07 - 09','CHALLENGE',['Walk-forward backtest','Cost & liquidity adjustment','Trader dashboard'])]
for i,(n,title,rows) in enumerate(stages):
    x=M+i*174
    rect(x,586,159,133,white,BORDER,r=4)
    label(n,x+13,599,GOLD);text(title,x+13,619,10,'Medium')
    for j,s in enumerate(rows):text(s,x+13,647+j*20,8.3,'Sans',MUTED)
    if i<2:arrow(x+160,652,x+173,652)
foot('Architecture evidence: api/app, web/src and compose.yaml. The diagram describes the implemented design; the Docker/PostgreSQL runtime has not yet been executed on the development host.')
c.showPage()

# 03 / Data integrity and normalization
page(3,'Data integrity','The units must agree.','Normalization is auditable. Provenance and contract verification remain separate controls.')
for i,(v,n,note) in enumerate([('13,144','OBSERVATIONS','03 Mar 2025 - 09 Oct 2026'),('420','OBSERVED SESSIONS','Synthetic business-day fixtures'),('4','GOLD CONTRACTS','Configured outside the calculation logic')]):
    metric(M+i*174,205,156,v,n,note,size=25)
rule_title('Contract defaults - operator verification pending',M,305,CW)
widths=[110,74,82,67,174];starts=[M]
for w in widths[:-1]:starts.append(starts[-1]+w)
for i,s in enumerate(['SYMBOL','LOT / g','QUOTE / g','PURITY','DELIVERY BASIS']):label(s,starts[i]+8,342,size=7)
order=['GOLDM','GOLDTEN','GOLDGUINEA','GOLDPETAL']
for r,symbol in enumerate(order):
    yy=362+r*27;spec=DATA['specs'][symbol]
    if r%2==0:rect(M,yy-5,CW,27,white)
    vals=[symbol,str(int(spec['lot_size_grams'])),str(int(spec['quote_unit_grams'])),str(int(spec['purity']*1000)),spec['location']]
    for i,s in enumerate(vals):text(s,starts[i]+8,yy,9,'Mono' if i in [1,2,3] else 'Sans')
line(M,469,W-M,469)
mini=next(q for q in DATA['snapshot'] if q['contract']=='GOLDM')
label('WORKED EXAMPLE / GOLDM / 09 OCT 2026 / SAMPLE DATA',M,487,GOLD)
flow=[(f'INR {mini["settle"]:,.2f}','Settlement quote'),(f'INR {mini["per_gram"]:,.2f}','Per gram before purity'),(f'INR {mini["pure"]:,.2f}','Per fine gram')]
for i,(v,sub) in enumerate(flow):
    x=M+i*174;rect(x,511,159,65,PALE if i==2 else white,BORDER,r=4)
    text(v,x+12,527,14,'Mono',GOLD if i==2 else INK);text(sub,x+12,553,7.6,'Sans',MUTED)
    if i<2:arrow(x+160,543,x+173,543)
text('Divide by 10 quotation grams',M+58,585,7.5,'Sans',MUTED)
text('Then divide by 0.995 purity',M+287,585,7.5,'Sans',MUTED)
rule_title('Latest sample participation',M,614,238)
rule_title('Enforced import controls',M+269,614,238)
maxvol=max(q['volume'] for q in DATA['snapshot'])
for i,symbol in enumerate(order):
    q=next(q for q in DATA['snapshot'] if q['contract']==symbol);yy=647+i*23
    text(symbol.replace('GOLD',''),M,yy+1,7.5,'Sans',MUTED)
    rect(M+47,yy+1,122*q['volume']/maxvol,8,GOLD if i==0 else BLUE,r=1)
    text(f'{q["volume"]:,}',M+234,yy,8,'Mono',INK,'right')
for i,s in enumerate(['Unambiguous dates; actual expiry retained','Positive finite settlement; integral volume/OI','Options excluded; duplicate conflicts rejected','Atomic writes; SHA-256 repeat detection']):
    yy=646+i*22;circle(M+273,yy+4,2,GREEN,GREEN);para(s,M+282,yy-1,222,8.2,MUTED,leading=10)
text('Volume = traded lots. Zero-baseline bars; displayed prices rounded.',M,746,7.2,'Sans',MUTED)
foot('Source: sample database, contracts.yaml and ingestion tests. Defaults are illustrative until verified for each historical expiry. Gold Petal has a different delivery location; purity normalization does not remove that basis.')
c.showPage()

# 04 / Relative-value evidence
page(4,'Signal validation','A deviation is not a trade.','Sample data | 09 October 2026 | October 2026 expiry | Prior 30-observation baseline')
active=sum(s['eligible'] for s in DATA['signals']);widest=max(abs(s['spread_bps']) for s in DATA['signals'])
for i,(v,n,note) in enumerate([(str(active),'QUALIFIED SIGNALS','All current pairs remain below |z| = 2'),(f'{widest:.2f} bp','WIDEST ABSOLUTE SPREAD','Across six canonical pairs'),(f'{DATA["carry"]*100:.2f}%','ANNUALIZED CARRY','GOLDM: nearest two expiries')]):metric(M+i*174,204,157,v,n,note,size=24)
rule_title('GOLDM / GOLDTEN normalized spread',M,300,CW)
history=DATA['spreads'];dates=[p['date'] for p in history]
vals=[p['spread'] for p in history];means=[p['mean'] for p in history]
lower=[None if p['mean'] is None else p['mean']-2*p['std'] for p in history];upper=[None if p['mean'] is None else p['mean']+2*p['std'] for p in history]
xy=chart_axes(M+36,344,CW-45,143,-60,60,4,dates=dates)
band(lower,upper,xy);series(means,xy,BLUE,1,dash=[3,2]);series(vals,xy,GOLD,1.25)
text('bps',M+4,335,7.5,'Mono',MUTED)
legend([('Spread',GOLD,None),('Prior mean',BLUE,[3,2]),('Prior +/-2 sigma band',HexColor('#D3C197'),None)],M+36,518)
rule_title('Pairwise z-scores',M,551,249)
labels=['M','TEN','GUINEA','PETAL'];xx=M+51;yy=601;cell=40
for j,s in enumerate(labels):text(s,xx+j*cell+19,580,7.2,'Medium',MUTED,'center')
for i,a in enumerate(order):
    text(labels[i],xx-8,yy+i*cell+14,7.2,'Medium',MUTED,'right')
    for j,b in enumerate(order):
        if a==b:z=0
        else:
            direct=next((s for s in DATA['signals'] if s['a']==a and s['b']==b),None)
            inverse=next((s for s in DATA['signals'] if s['a']==b and s['b']==a),None)
            z=direct['z'] if direct else -inverse['z']
        strength=min(abs(z)/3,1)
        base=(.18,.47,.39) if z<0 else (.63,.32,.38)
        fill=Color(*[1-(1-v)*(.10+strength*.58) for v in base]) if i!=j else HexColor('#F0F1EE')
        rect(xx+j*cell,yy+i*cell,37,37,fill,r=2);text(f'{z:.2f}',xx+j*cell+18.5,yy+i*cell+13,8.5,'Mono',INK,'center')
rule_title('Qualification sequence',M+277,551,230)
for i,(title,body) in enumerate([('01 / Significance','Absolute z-score exceeds 2.'),('02 / Costs','Expected reversion exceeds round-trip cost.'),('03 / Liquidity','Each leg meets grade A or B.'),('04 / Comparability','Exact expiry and compatible delivery basis.')]):
    ty=585+i*42;text(title,M+277,ty,8.8,'Medium');para(body,M+277,ty+15,230,8.2,MUTED,leading=10)
foot('Chart points and matrix are computed from synthetic observations. Reverse cells are negative canonical-pair z-scores. Imported signals also require operator-verified specs. No qualified signal is fabricated when filters fail.')
c.showPage()

# 05 / Replay evidence
b=DATA['backtest'];mt=b['metrics'];cost=mt['gross_bps']-mt['net_bps'];equity=b['equity']
page(5,'Backtest evidence','Gross promise. Net reality.','Default experiment | GOLDM / GOLDTEN | October 2026 expiry | Synthetic data only')
for i,(v,n,note,col) in enumerate([(f'{mt["gross_bps"]:.2f}','GROSS P&L / bps','Before modeled costs',INK),(f'{mt["net_bps"]:.2f}','NET P&L / bps','After incurred modeled costs',GREEN),(f'{cost:.2f}','MODELED COST / bps',f'{cost/mt["gross_bps"]*100:.1f}% of gross P&L absorbed',RED)]):metric(M+i*174,202,158,v,n,note,col,size=26)
rule_title('Cumulative research P&L',M,302,CW)
dates=[p['date'] for p in equity]
xy=chart_axes(M+37,344,CW-49,146,-40,160,5,dates=dates)
series([p['gross'] for p in equity],xy,BLUE,1.15,dash=[3,2]);series([p['net'] for p in equity],xy,GOLD,1.6)
legend([('Gross',BLUE,[3,2]),('Net of costs',GOLD,None)],M+38,522)
label('NET DRAWDOWN / bps',M,550,size=7.3)
xy=chart_axes(M+37,577,CW-49,62,-40,0,2)
draw=[p['drawdown'] for p in equity];band(draw,[0]*len(draw),xy,HexColor('#F3E5E5'));series(draw,xy,RED,1)
for i,(v,n) in enumerate([(f'{mt["sharpe"]:.2f}','SHARPE'),(f'{mt["hit_rate"]*100:.1f}%','HIT RATE'),(str(mt['trades']),'CLOSED TRADES'),(f'{mt["max_drawdown_bps"]:.2f}','MAX DRAWDOWN / bp')]):
    x=M+i*130;label(n,x,660,size=6.9);text(v,x,679,19,'Mono',INK)
rect(M,713,CW,43,PALE,r=4)
text(f'95% bootstrap interval: {mt["bootstrap_low_bps"]:.2f} to {mt["bootstrap_high_bps"]:.2f} bps',M+12,723,9.6,'Medium')
text('The interval crosses zero. Positive net simulation does not establish an executable edge.',M+12,739,8.1,'Sans',MUTED)
foot('Parameters: train 30 / test 10 sessions; entry |z| > 2; exit |z| <= 0.5; max hold 10; fees 1.5 bp/leg/side + slippage. 130 replay observations, 13 folds, 0 terminal positions. P&L basis: one-leg notional, fractional lots.')
c.showPage()

# 06 / Verification and engineering quality
page(6,'Engineering assurance','Test the claim, not the label.','Executed local checks support the stated behavior. Counts are not a code-coverage percentage.')
for i,(v,n,note) in enumerate([('37 / 37','BACKEND TESTS PASSED','Analytics, imports and API contracts'),('9 / 9','BROWSER CHECKS PASSED','Core flows, exports and failure states'),('10','ACCESSIBILITY VIEW/THEMES','Five key views in each of two themes')]):metric(M+i*174,203,157,v,n,note,size=23)
rule_title('No-look-ahead: the execution clock',M,309,CW)
steps=[('TRAIN','Prior 30 observations'),('TEST','Next 10 unseen sessions'),('SIGNAL','At the observed close'),('MODEL FILL','Next eligible open')]
for i,(head,body) in enumerate(steps):
    x=M+i*130;rect(x,340,117,67,PALE if i==0 else white,BORDER,r=4);label(head,x+10,353,GOLD,size=7.5);para(body,x+10,374,98,8.4,MUTED,leading=10.5)
    if i<3:arrow(x+118,374,x+129,374)
para('Future prices are mutated and the dataset is truncated in tests. Earlier equity must remain identical. Missing opens and thin liquidity cannot create synthetic fills.',M,423,CW,9.2,MUTED,leading=13)
rule_title('Evidence register',M,472,CW)
rows=[('Production build','TypeScript and optimized Vite build','PASSED'),('Accessibility automation','No detected A/AA violations on scoped views','PASSED'),('Dependency review','0 reported frontend production vulnerabilities','PASSED'),('Failure handling','API errors, empty source, invalid imports','PASSED'),('Container runtime','Docker / Nginx / PostgreSQL execution','NOT RUN')]
for i,(name,detail,status) in enumerate(rows):
    y=505+i*29;line(M,y+23,W-M,y+23)
    text(name,M,y,8.8,'Medium');text(detail,M+124,y,8.1,'Sans',MUTED)
    text(status,W-M,y,7.7,'Medium',GREEN if status=='PASSED' else GOLD,'right')
rule_title('Chart payload reduction - compressed build output',M,666,CW)
sizes=[('Full Plotly',1467.84,BLUE),('Cartesian subset',503.50,GOLD)]
for i,(name,kb,col) in enumerate(sizes):
    y=698+i*28;text(name,M,y,8.5,'Sans',MUTED);rect(M+113,y+1,260*kb/1467.84,10,col,r=1);text(f'{kb:,.2f} kB',W-M,y,8.5,'Mono',INK,'right')
foot('Chart gzip payload reduced by 65.7%; the 503.50 kB chunk remains lazily loaded. Automated accessibility is not full WCAG certification. Tooling warnings: Plotly chunk size and Starlette test-client deprecation.')
c.showPage()

# 07 / Decision, gates and sources
page(7,'Release decision','Evidence before release.','The next milestone is staging acceptance, not a claim of zero defects or live trading readiness.')
pill('STAGING CANDIDATE',M,203,color=GOLD,fill=PALE)
text('Seven release gates remain open.',M+141,210,9.5,'Sans',MUTED)
gates=[('Container execution','Run Compose with PostgreSQL; exercise import/update and concurrent replay.'),('Hosting & access','Verify TLS, domain routing, trusted proxies, identity and monitoring.'),('Actual MCX files','Accept authorized files; verify symbol, expiry, option and OI semantics.'),('Historical specifications','Validate contract settings against every relevant expiry and delivery basis.'),('Execution assumptions','Calibrate fees/slippage; document lot, margin and market-depth limitations.'),('Recovery & capacity','Test encrypted backup/restore, rollback and latency/capacity budgets.'),('Accessibility review','Complete manual keyboard and screen-reader acceptance across all views.')]
for i,(head,body) in enumerate(gates):
    yy=250+i*53
    text(f'{i+1:02d}',M,yy+2,11,'Mono',GOLD)
    text(head,M+34,yy,10.1,'Medium')
    para(body,M+34,yy+17,CW-83,8.8,MUTED,leading=11.5)
    text('OPEN',W-M,yy+3,7.2,'Medium',GOLD,'right')
    line(M+34,yy+44,W-M,yy+44)
rule_title('Source and reproducibility index',M,635,CW)
source_rows=[
    ('S1','Validation record','docs/VERIFICATION.md; api/tests; web/tests'),
    ('S2','Analytical figures','Recomputed from sample data on 10 Oct 2026; defaults, no tuning'),
    ('S3','Model boundaries','docs/METHODOLOGY.md; docs/ACCEPTANCE.md'),
    ('S4','Official reference sources','MCX product specifications and MCXCCL UDiFF schema; docs/SOURCES.md'),
]
for i,(n,title,body) in enumerate(source_rows):
    yy=665+i*21;text(n,M,yy,7.3,'Mono',GOLD);text(title,M+24,yy,8,'Medium');text(body,M+129,yy,7.25,'Sans',MUTED)
c.linkURL('https://www.mcxindia.com/products/bullion/gold-mini',(M+129,H-737,W-M,H-725),relative=0,thickness=0)
foot('Roadmap, not shipped services: mobile alerts, trained ML anomaly detection, billing, team roles, enterprise connectors and new markets. Independent audit, public hosting and actual-market validation are outside this report.')
c.showPage()
c.save()
reader=PdfReader(str(OUT))
assert len(reader.pages)==7,len(reader.pages)
for index,p in enumerate(reader.pages):
    assert len(p.extract_text())>500,(index,'unexpectedly empty page')
assert '30.15' in reader.pages[4].extract_text()
assert '37 / 37' in reader.pages[5].extract_text()
print(f'Created {OUT} ({OUT.stat().st_size:,} bytes), {len(reader.pages)} pages')
