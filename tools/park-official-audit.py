#!/usr/bin/env python3
"""Offline official CSV / website evidence audit. Never writes input, Sheets, or GAS.
Website pages must be reviewed capture JSON; this does not fabricate a live site crawler.
"""
import argparse,json,csv,hashlib,datetime,shutil
from pathlib import Path
from park_source_quality import parse_csv,match_park,feature_evidence,FEATURES,norm,valid,distance

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('csv',type=Path);p.add_argument('snapshot',type=Path);p.add_argument('output',type=Path);p.add_argument('--crs',choices=['EPSG:4326','EPSG:3826']);p.add_argument('--quality',type=Path);p.add_argument('--risk',type=Path);p.add_argument('--website-pages',type=Path)
 a=p.parse_args();files=[a.csv,a.snapshot]+[f for f in [a.quality,a.risk,a.website_pages] if f];before={str(f.resolve()):hashlib.sha256(f.read_bytes()).hexdigest() for f in files}
 parsed=parse_csv(a.csv.read_bytes(),a.crs);snapshot=json.loads(a.snapshot.read_text());parks=[r for r in snapshot['parks'] if norm(r.get('縣市'))=='新北市'];facilities=snapshot.get('facilities',[]);quality=json.loads(a.quality.read_text()) if a.quality else [];risk=json.loads(a.risk.read_text()) if a.risk else []
 q={r['id']:r for r in quality};riskids={r['parkId'] for r in risk};pages=json.loads(a.website_pages.read_text()) if a.website_pages else []
 a.output.mkdir(mode=0o700);shutil.copyfile(a.csv,a.output/('source-'+a.csv.name))
 results=[];used=set();protected=[]
 for park in parks:
  id=park['公園ID'];m=match_park(park,parsed['rows']);r=m['candidates'][0] if len(m['candidates'])==1 else None;confirmed=m['status']=='已確認';coordinate=r if confirmed and r['coordinateVerified'] else None
  if confirmed:used.add(r['sourceRow'])
  if valid(park['緯度'],park['經度']) and park['資料狀態']=='可用':protected.append(id)
  item={'parkId':id,'name':park['公園名稱'],'district':park['行政區'],'address':park['地址'],'management':park['管理單位'],'matchStatus':m['status'],'matchScope':'IDENTITY_AND_ADDRESS_ONLY','matchFactors':m['factors'],'matchReason':m['reason'],'sourceRows':[v['sourceRow'] for v in m['candidates']],'officialName':r['name'] if r else None,'officialAddress':r['address'] if r else None,'sourceFileSha256':parsed['sourceSha256'],'sourceUrlDeclaredBySnapshot':park.get('來源網址'),'sourcePublicationDate':None,'officialLatitude':coordinate['latitude'] if coordinate else None,'officialLongitude':coordinate['longitude'] if coordinate else None,'coordinateMatchStatus':'待人工審核' if coordinate else '無法匹配：無已驗證來源座標','formalLatitudeProtected':park['緯度'],'formalLongitudeProtected':park['經度'],'formalStatus':park['資料狀態'],'formalDeltaMeters':distance(park['緯度'],park['經度'],coordinate['latitude'],coordinate['longitude']) if coordinate and valid(park['緯度'],park['經度']) else None,'priorGrade':q.get(id,{}).get('grade'),'priorHighRisk':id in riskids,'entranceVerified':False,'publicationApproved':False}
  results.append(item)
 website=[];bypark={r['parkId']:[] for r in results}
 for page in pages:
  source={'公園名稱':page.get('name'),'行政區':page.get('district'),'地址':page.get('address'),'管理單位':page.get('management')}
  inverse=[{'name':r['公園名稱'],'district':r['行政區'],'address':r['地址'],'management':r.get('管理單位'),'parkId':r['公園ID']} for r in parks]
  m=match_park(source,inverse);id=m['candidates'][0]['parkId'] if m['status']=='已確認' else None
  if id and next(r for r in results if r['parkId']==id)['matchStatus']!='已確認':m['status']='待人工審核';id=None
  website.append({'sourceUrl':page.get('url'),'name':page.get('name'),'district':page.get('district'),'address':page.get('address'),'rawFacilityDescription':page.get('facilityDescription'),'retrievedAt':page.get('retrievedAt'),'sourcePublicationDate':page.get('sourcePublishedAt'),'matchStatus':m['status'],'parkId':id,'matchFactors':m['factors'],'operatorVerified':page.get('operatorVerified') is True,'termsReviewed':page.get('termsReviewed') is True,'publicationApproved':False})
  if id:bypark[id].extend([dict(e,sourcePublicationDate=page.get('sourcePublishedAt')) for e in feature_evidence(page,m)])
 feature_rows=[]
 for result in results:
  id=result['parkId']
  for feature in FEATURES:
   evidence=[r for r in bypark[id] if r['feature']==feature and r['status']=='已確認'];e=evidence[0] if evidence else {'feature':feature,'status':'UNKNOWN','count':None,'rawQuote':None,'sourceUrl':None,'retrievedAt':None,'sourcePublicationDate':None,'entranceVerified':False,'publicationApproved':False}
   feature_rows.append(dict(parkId=id,name=result['name'],district=result['district'],**e))
 def writejson(name,obj):
  with (a.output/name).open('x',encoding='utf-8') as f:json.dump(obj,f,ensure_ascii=False,indent=2,allow_nan=False);f.write('\n')
 def writecsv(name,rows,cols):
  with (a.output/name).open('x',encoding='utf-8-sig',newline='') as f:
   w=csv.DictWriter(f,cols,extrasaction='ignore');w.writeheader()
   for row in rows:
    safe={k:'；'.join(map(str,v)) if isinstance(v,list) else v for k,v in row.items()}
    for k,v in safe.items():
     if isinstance(v,str) and v.lstrip().startswith(('=','+','-','@')):safe[k]="'"+v
    w.writerow(safe)
 writejson('matches.json',results);writecsv('identity-matches.csv',results,list(results[0]) if results else ['parkId','matchStatus']);writecsv('unmatched-parks.csv',[r for r in results if r['matchStatus']!='已確認'],list(results[0]) if results else ['parkId']);writecsv('high-risk-matches.csv',[r for r in results if r['priorHighRisk']],list(results[0]) if results else ['parkId'])
 writejson('unmatched-source-records.json',[r for r in parsed['rows'] if r['sourceRow'] not in used]);writecsv('website-pages.csv',website,list(website[0]) if website else ['sourceUrl','name','district','address','rawFacilityDescription','retrievedAt','matchStatus']);writecsv('unmatched-website-pages.csv',[r for r in website if r['matchStatus']!='已確認'],list(website[0]) if website else ['sourceUrl','matchStatus']);writecsv('feature-evidence.csv',feature_rows,list(feature_rows[0]) if feature_rows else ['parkId','feature','status'])
 types={s:sum(r['matchStatus']==s for r in results) for s in ['已確認','待人工審核','無法匹配']}
 summary={'csvFilename':a.csv.name,'csvBytes':a.csv.stat().st_size,'sourceSha256':parsed['sourceSha256'],'encoding':parsed['encoding'],'headers':parsed['headers'],'officialRows':len(parsed['rows']),'coordinateSystem':parsed['coordinateSystem'],'coordinateColumnsPresent':parsed['coordinateColumnsPresent'],'sourceProvenance':'user-supplied declared official CSV; no independent network acquisition or publication date metadata','snapshotAvailable':True,'priorQualityAvailable':bool(a.quality),'priorRiskAvailable':bool(a.risk),'snapshotNtpcParks':len(parks),'identityMatches':types,'identityMatchRate':types['已確認']/len(parks) if parks else None,'officialCoordinateComparisonCount':sum(r['officialLatitude'] is not None for r in results),'sourceUnmatchedRecords':len(parsed['rows'])-len(used),'protectedFormalIds':protected,'protectedFormalCount':len(protected),'formalCoverageRate':len(protected)/len(parks) if parks else None,'priorHighRiskRows':len(riskids),'websitePagesObtained':len(pages),'websiteConfirmedIdentityMatches':sum(r['matchStatus']=='已確認' for r in website),'confirmedFeatureEvidenceRows':sum(r['status']=='已確認' for r in feature_rows),'featureUnknownRows':sum(r['status']=='UNKNOWN' for r in feature_rows),'featureCountsNeverInferred':True,'entrancesVerified':0,'productionCoordinatesApproved':0,'sourceFilesSha256':before,'generatedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat()}
 for f in files:assert hashlib.sha256(f.read_bytes()).hexdigest()==before[str(f.resolve())]
 writejson('summary.json',summary);print(json.dumps(summary,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
