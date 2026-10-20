"""Pure offline CSV identity/coordinate and feature evidence checks. Never grants publication."""
import csv,io,hashlib,unicodedata,math,re
from urllib.parse import urlsplit
ALIASES={'id':['seqno','公園ID','id'],'name':['name','公園名稱'],'district':['area','行政區'],'address':['address','地址'],'management':['management','管理單位'],'lat':['latitude','lat','緯度'],'lon':['longitude','lng','lon','經度'],'x':['TW97X','TWD97_X'],'y':['TW97Y','TWD97_Y']}
FEATURES={'slide':['溜滑梯','磨石滑梯','滑梯'],'swing':['鞦韆','秋千'],'sandpit':['沙坑','砂坑'],'climbing':['攀爬'],'water_play':['戲水','噴水遊戲'],'inclusive':['共融遊戲場','共融遊具','融合式遊戲場']}
def norm(v):return ''.join(unicodedata.normalize('NFKC',str(v or '')).replace('臺','台').replace('芦','蘆').replace('区','區').split())
def address(v,district):return norm(v).removeprefix('新北市').removeprefix(norm(district))
def valid(lat,lon):
 try:
  if isinstance(lat,bool) or isinstance(lon,bool) or lat in ('',None) or lon in ('',None):return False
  return 21<=float(lat)<=26 and 119<=float(lon)<=123
 except (TypeError,ValueError):return False
def distance(a,b,c,d):
 a,b,c,d=map(math.radians,map(float,[a,b,c,d]));h=math.sin((c-a)/2)**2+math.cos(a)*math.cos(c)*math.sin((d-b)/2)**2
 return 6371000*2*math.asin(min(1,math.sqrt(h)))
def twd97(x,y):
 # EPSG:3826, TWD97 TM2 zone121; explicit CRS is required by caller.
 a=6378137.;b=6356752.314245;k=.9999;e=math.sqrt(1-b*b/a/a);ep=(e*a/b)**2;x=float(x)-250000;y=float(y)
 mu=y/k/(a*(1-e*e/4-3*e**4/64-5*e**6/256));e1=(1-math.sqrt(1-e*e))/(1+math.sqrt(1-e*e))
 fp=mu+(3*e1/2-27*e1**3/32)*math.sin(2*mu)+(21*e1**2/16-55*e1**4/32)*math.sin(4*mu)+151*e1**3/96*math.sin(6*mu)+1097*e1**4/512*math.sin(8*mu)
 C=ep*math.cos(fp)**2;T=math.tan(fp)**2;N=a/math.sqrt(1-e*e*math.sin(fp)**2);R=a*(1-e*e)/(1-e*e*math.sin(fp)**2)**1.5;D=x/(N*k)
 lat=fp-N*math.tan(fp)/R*(D*D/2-(5+3*T+10*C-4*C*C-9*ep)*D**4/24+(61+90*T+298*C+45*T*T-3*C*C-252*ep)*D**6/720)
 lon=121*math.pi/180+(D-(1+2*T+C)*D**3/6+(5-2*C+28*T-3*C*C+8*ep+24*T*T)*D**5/120)/math.cos(fp)
 return math.degrees(lat),math.degrees(lon)
def parse_csv(blob,crs=None):
 if len(blob)>32*1024*1024:raise ValueError('CSV exceeds safe size')
 encoding=None
 for enc in ['utf-8-sig','cp950']:
  try:text=blob.decode(enc);encoding=enc;break
  except UnicodeDecodeError:pass
 if encoding is None:raise ValueError('Unsupported encoding; no lossy decoding')
 if '\x00' in text:raise ValueError('NUL in CSV')
 reader=csv.reader(io.StringIO(text,newline=''),strict=True);headers=next(reader,[]);headers=[h.strip() for h in headers]
 if not headers or any(not h for h in headers) or len(set(headers))!=len(headers):raise ValueError('Missing/duplicate/blank header')
 columns={}
 for key,aliases in ALIASES.items():
  found=[h for h in aliases if h in headers]
  if len(found)>1:raise ValueError('Ambiguous column aliases: '+key)
  if found:columns[key]=found[0]
 if not all(k in columns for k in ['name','district','address']):raise ValueError('Name, district and address required')
 if crs not in [None,'EPSG:4326','EPSG:3826']:raise ValueError('Unsupported CRS')
 if ('lat' in columns)!=('lon' in columns) or ('x' in columns)!=('y' in columns):raise ValueError('Partial coordinate pair')
 has_geo='lat' in columns;has_xy='x' in columns
 if crs=='EPSG:3826' and not has_xy:raise ValueError('EPSG:3826 requires explicit x/y columns')
 if crs=='EPSG:4326' and not has_geo:raise ValueError('EPSG:4326 requires latitude/longitude')
 system='NOT_PROVIDED' if not has_geo and not has_xy else crs or ('GEOGRAPHIC_DATUM_UNVERIFIED' if has_geo else 'PROJECTED_CRS_UNVERIFIED')
 rows=[]
 for number,values in enumerate(reader,2):
  if not values or not any(values):continue
  if len(values)!=len(headers):raise ValueError('CSV row width mismatch: '+str(number))
  raw=dict(zip(headers,values));row={k:raw[h] for k,h in columns.items()};row.update(sourceRow=number,raw=raw,latitude=None,longitude=None,coordinateVerified=False)
  if crs=='EPSG:4326' and valid(row.get('lat'),row.get('lon')):row.update(latitude=float(row['lat']),longitude=float(row['lon']),coordinateVerified=True)
  if crs=='EPSG:3826':
   try:
    lat,lon=twd97(row['x'],row['y'])
    if valid(lat,lon):row.update(latitude=lat,longitude=lon,coordinateVerified=True)
   except (ValueError,OverflowError,ZeroDivisionError):pass
  rows.append(row)
  if len(rows)>100000:raise ValueError('Too many CSV records')
 return {'encoding':encoding,'headers':headers,'rows':rows,'coordinateSystem':system,'sourceSha256':hashlib.sha256(blob).hexdigest(),'coordinateColumnsPresent':has_geo or has_xy}
def match_park(park,rows):
 district=norm(park.get('行政區'));name=norm(park.get('公園名稱'));addr=address(park.get('地址'),district)
 candidates=[r for r in rows if norm(r['name'])==name and norm(r['district'])==district]
 exact=[r for r in candidates if addr and address(r['address'],district)==addr]
 if len(exact)==1:
  r=exact[0];owner=norm(park.get('管理單位'));other=norm(r.get('management'))
  if owner and other and owner!=other:return {'status':'待人工審核','candidates':exact,'factors':['name','district','address'],'reason':'管理單位衝突'}
  if r.get('coordinateVerified') and valid(park.get('緯度'),park.get('經度')) and distance(park['緯度'],park['經度'],r['latitude'],r['longitude'])>300:
   return {'status':'待人工審核','candidates':exact,'factors':['name','district','address'],'reason':'來源與正式座標差距超過300m，禁止自動確認'}
  return {'status':'已確認','candidates':exact,'factors':['name','district','address']+(['management'] if owner and other else []),'reason':'僅確認公園身分與地址；座標／入口及發布未核准'}
 return {'status':'待人工審核' if candidates else '無法匹配','candidates':candidates,'factors':['name','district'] if candidates else [],'reason':'同名多筆或地址未能對應' if candidates else '未找到名稱及行政區相符紀錄'}
def feature_evidence(page,match):
 url=urlsplit(str(page.get('url','')))
 governed=(url.scheme=='https' and url.hostname in ['www.ntparks.tw','ntparks.tw'] and page.get('httpStatus')==200 and page.get('operatorVerified') is True and page.get('termsReviewed') is True and page.get('retrievedAt') and match.get('status')=='已確認' and {'name','district','address'}.issubset(match.get('factors',[])))
 text=str(page.get('facilityDescription',''));clauses=re.split(r'[。；;\n]',text)
 result=[]
 for feature,words in FEATURES.items():
  quote=None
  if governed:
   for clause in clauses:
    if not any(word in clause for word in words):continue
    # Keep absent/planned/nearby/closed statements UNKNOWN; never turn omissions into absence.
    if re.search(r'沒有|未設|不設|不提供|暫停|關閉|撤除|移除|拆除|非共融|不是.*共融|不屬於.*共融|無(?:鞦韆|滑梯|溜滑梯|沙坑|攀爬|戲水|共融)|規劃|預計|將設|施工|維修|未開放|鄰近|附近|周邊|對面',clause):continue
    quote=clause.strip();break
  result.append({'feature':feature,'status':'已確認' if quote else 'UNKNOWN','count':None,'rawQuote':quote,'sourceUrl':page.get('url') if quote else None,'retrievedAt':page.get('retrievedAt') if quote else None,'entranceVerified':False,'publicationApproved':False})
 return result
