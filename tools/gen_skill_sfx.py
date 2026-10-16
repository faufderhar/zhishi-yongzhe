#!/usr/bin/env python3
"""程序化合成《知识勇者》85 个角色技能音效（自制合成，CC0）。
用法: python3 tools/gen_skill_sfx.py   (需要 numpy + ffmpeg；重新合成全部音效并重建清单)
      python3 tools/gen_skill_sfx.py --manifest-only   (不合成，只按现有文件重建 skills-manifest.json / manifest.json)
源: /workspace/playtest/技能特效素材清单.md §3 的表格（顺序决定序号）。"""
import re, json, subprocess, os, csv, numpy as np
SR = 44100
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public/sfx/skills'); KG = os.path.join(OUT, 'kindergarten')
LIST = '/workspace/playtest/技能特效素材清单.md'
STAGE = {'小班': 'k', '小学1–2': 'p12', '小学3–6': 'p36', '初一': 'j1', '高一': 'h1'}
CHAR = {'算算':'suansuan','墨墨':'momo','阿贝':'abei','诗诗':'shishi','杯杯':'beibei',
        '阿算':'asuan','小墨':'xiaomo','Lexi':'lexi','小白':'xiaobai','铂拉':'bola'}
rng = np.random.default_rng(7)
def t(d): return np.arange(int(SR*d))/SR
def env(n, a=0.005, r=None):
    e = np.ones(n); na = max(1,int(a*SR)); e[:na] = np.linspace(0,1,na)
    r = r if r is not None else n/SR*0.9; nr = min(n, max(1,int(r*SR)))
    e[-nr:] *= np.exp(-np.linspace(0,5,nr)); return e
def lp(x, fc):  # one-pole lowpass x2
    a = np.exp(-2*np.pi*fc/SR)
    for _ in range(2):
        y = np.empty_like(x); s = 0.0
        for i,v in enumerate(x): s = (1-a)*v + a*s; y[i] = s
        x = y
    return x
def hp(x, fc): return x - lp(x, fc)
def sine(f0, d, f1=None, a=0.005, harm=(1,), r=None):
    tt = t(d); f = np.linspace(f0, f1 or f0, len(tt)); ph = 2*np.pi*np.cumsum(f)/SR
    y = sum(np.sin(ph*h)/h**1.5 for h in harm); return y*env(len(tt), a, r)
def noise(d, fc_lo=200, fc_hi=3000, a=0.05, r=None):
    y = rng.standard_normal(int(SR*d)); y = hp(lp(y, fc_hi), fc_lo); return y/ (np.abs(y).max()+1e-9) * env(len(y), a, r)
# ---- 基本音色 ----
def pop(f=600): return sine(f*1.6, .09, f, a=.002, r=.08)
def wood(f=300): return sine(f,.15,f*.9,a=.001,r=.12,harm=(1,2.7))
def bell(f=880, d=.8): return sine(f,d,a=.002,harm=(1,2.76,5.4),r=d)
def xylo(f=660): return sine(f,.25,a=.001,harm=(1,4),r=.22)
def harp(f=440,d=.6): return sine(f,d,a=.003,harm=(1,2,3),r=d)
def whoosh(d=.5, lo=300, hi=2500): n = noise(d,lo,hi,a=d*.4,r=d*.5); return n*np.sin(np.linspace(0,np.pi,len(n)))
def thump(f=90, d=.3): return sine(f*1.8, d, f, a=.002, r=d)
def hum(f=110, d=.8): return sine(f,d,a=.15,harm=(1,2,3),r=.3)*(1+.2*np.sin(2*np.pi*6*t(d)))
def metal(f=1200, d=.35): return sine(f,d,a=.001,harm=(1,1.5,2.3,3.1),r=d)*.6+0.4*noise(d,2000,6000,a=.001,r=.08)
def flute(f=660, d=.8): tt=t(d); return sine(f,d,a=.12,r=.25)*(1+.05*np.sin(2*np.pi*5*tt))+.05*noise(d,800,3000,a=.1)
def drop(f=900): return sine(f*.7,.18,f*1.8,a=.001,r=.15)
def chirp(f=2500): return np.concatenate([sine(f,.06,f*1.3,a=.005,r=.05),np.zeros(int(.03*SR)),sine(f*1.1,.07,f*1.4,a=.005,r=.05)])
def gurgle(d=.6): return np.concatenate([pop(f) for f in rng.uniform(200,450,int(d/.09))])
def zither(f=330,d=.7): return sine(f,d,f*1.5,a=.002,harm=(1,2,3,4),r=d)
def mix(*parts, total=1.1):
    out = np.zeros(int(SR*total))
    for at, sig in parts:
        s = int(at*SR); sig = np.asarray(sig)[:len(out)-s]; out[s:s+len(sig)] += sig
    return out
SCALE = [523,587,659,784,880,1047,1175,1319]
# ---- 按音效描述选配方 ----
def recipe(desc, gentle, name):
    d = desc; P=[]; T=1.0
    def has(*k): return any(x in d for x in k)
    if has('啵、嘭'): P=[(0,pop(500)),(.35,thump(120,.35))]
    elif has('嗒嗒嗒嘭'): P=[(i*.12,wood(700)) for i in range(3)]+[(.42,thump(100,.4)),(.42,whoosh(.3,200,1500)*.4)]
    elif has('啵、啵、啵','啵啵啵','「啵啵」'): k=2 if d.strip('「」|  ')=='「啵啵」' else 3; P=[(i*.22,pop(500+i*120)) for i in range(k)]
    elif has('咚咚','鼓'):
        if has('积木','木块'): P=[(0,wood(260)),(.2,wood(330))]+([(0.45,sine(523,.4,784,a=.05,harm=(1,2,3),r=.3))] if has('上扬') else [])
        elif has('三声小鼓'): P=[(i*.2,thump(160,.18)) for i in range(3)]
        elif has('古筝'): P=[(0,zither(220,.8)),(0.05,thump(70,.5))]
        elif has('浪涛'): P=[(0,whoosh(1.0,150,1500)),(.5,thump(70,.5))]
        else: P=[(0,thump(110,.5))]
    elif has('八音盒'): fs=[1047,1319,1568,1319,1175,1568]; P=[(i*.18,bell(f,.4)*.5) for i,f in enumerate(fs)]
    elif has('古筝滑音'): P=[(0,zither(262,1.0))]
    elif has('算盘'): P=[(i*.1,wood(900+i*40)) for i in range(5)]
    elif has('风铃'): P=[(0,whoosh(.3,800,4000)*.5)]+[(.3+i*.12,bell(SCALE[i*2+2],.5)*.4) for i in range(3)]
    elif has('翅膀'): P=[(i*.15,whoosh(.12,300,1500)) for i in range(6)]
    elif has('翻书') or has('翻卷轴'):
        P=[(0,whoosh(.25,1000,5000)*.6)]
        if has('箭雨'): P+=[(.3+i*.07,whoosh(.12,1500,5000)*.4) for i in range(8)]
        else: P+=[(.35,bell(1319 if not has('治疗') else 1047,.6))]
    elif has('气球'): P=[(0,noise(.12,200,1500,a=.002,r=.1)*.6)]+[(.2+i*.15,xylo(SCALE[i])) for i in range(5)]
    elif has('Hello'): P=[(0,sine(523,.18,659,a=.02,harm=(1,2,3),r=.1)),(.2,sine(659,.3,523,a=.02,harm=(1,2,3),r=.25))]  # 两音“Hel-lo”音型（真人录音可后替换）
    elif has('火车'): tt=t(.9); w=(np.sin(2*np.pi*440*tt)+np.sin(2*np.pi*554*tt))*env(len(tt),.08,.3)*(1+.1*np.sin(2*np.pi*5*tt)); P=[(0,w[:int(.4*SR)]*env(int(.4*SR),.05,.15)),(.45,w[:int(.6*SR)])]
    elif has('钢片琴','星光琶音'): fs=[1047,1319,1568,2093,1568,2093,1760]; k=3 if has('钢片') else 7; P=[(i*(.25 if k==3 else .12), bell(fs[i],.5)*.6) for i in range(k)]
    elif has('竖琴','琶音'): P=[(i*.08,harp(SCALE[i],.6)*.6) for i in range(8)]+([(0,whoosh(.8,300,2000)*.5)] if has('风声') else [])
    elif has('上扫'): P=[(0,sine(200,.6,1600,a=.05,harm=(1,2,3),r=.15)*.6),(.6,thump(90,.4))]
    elif has('旋风'): P=[(0,whoosh(.7,200,2000)),(.65,thump(100,.4))]
    elif has('风声'): P=[(0,whoosh(1.0,200,1800))]
    elif has('生长','咻~'): P=[(0,sine(300,.5,900,a=.05,r=.2))]+([(.6,chirp())] if has('鸟') else [(.5,bell(1319,.4)*.5)])
    elif has('鸟鸣'): P=[(0,chirp()),(.3,chirp(2800)),(.55,bell(1047,.5)),(.6,bell(1319,.5)*.6)]
    elif has('叮咚','水滴回响'): P=[(0,drop(900)),(.3,bell(784 if has('叮咚') else 1047,.7)*.5)]+([(.5,drop(700)*.4)] if has('回响') else [])
    elif has('火箭','咻—啪'): P=[(0,whoosh(.45,500,3000)),(.45,pop(800)),(.5,noise(.3,1000,4000,a=.002,r=.25)*.25)]
    elif has('毛笔','唰','重笔'):
        heavy = has('重'); n = 3 if has('唰唰唰') else (1 if not has('嘭') else 1)
        P=[(i*.2,whoosh(.22 if not heavy else .4,600 if not heavy else 200,4000)) for i in range(n)]
        if has('嘭'): P+=[(.35,thump(100,.4))]
    elif has('铃铛'): P=[(i*.18,bell(1175+i*100,.6)*.6) for i in range(3)]
    elif has('呜~'): P=[(0,sine(300,.8,500,a=.15,harm=(1,2),r=.3))]
    elif has('流水'): P=[(0,gurgle(.5)*.5),(0,noise(1.0,500,3000,a=.2)*.3),(.3,zither(392,.7))]
    elif has('虫鸣'): tt=t(.9); P=[(0,np.sin(2*np.pi*3800*tt)*(np.sin(2*np.pi*30*tt)>0)*env(len(tt),.1,.3)*.3)]
    elif has('欢呼'): P=[(0,noise(.15,200,1200,a=.002,r=.12))]+[(.25+i*.1,xylo(SCALE[[2,4,7][i]])) for i in range(3)]
    elif has('锵锵','金属斩','剑鸣'): P=[(0,metal(1200)),(.4,metal(1500))]
    elif has('嗡'): P=[(0,hum(110 if not has('低频') else 80,.9))]
    elif has('长笛'): P=[(0,flute(784,.5)),(.45,flute(880,.6))]
    elif has('竹笛'): P=[(0,flute(1047,.6)),(.55,thump(150,.3)*.6)]
    elif has('哈欠'): P=[(0,sine(500,.9,250,a=.2,harm=(1,2,3),r=.4)*.7+noise(.9,300,1500,a=.3,r=.4)*.2)]
    elif has('回声合成器'): P=[(i*.22,sine(880,.3,700,a=.01,harm=(1,2,3),r=.25)*(0.6**i)) for i in range(4)]
    elif has('回声'): P=[(i*.25,sine(660,.25,520,a=.01,harm=(1,2,3),r=.2)*(0.6**i)) for i in range(4)]
    elif has('嗖嗖嗖'): P=[(i*.2,whoosh(.18,1200,5000)) for i in range(3)]
    elif has('刹车'): P=[(0,sine(1200,.35,900,a=.02,harm=(1,1.5),r=.15)*.5+noise(.35,1000,3000,a=.02,r=.15)*.3),(.4,pop(400))]
    elif has('玻璃'): P=[(0,bell(2093,.5)*.6),(.25,noise(.3,200,1500,a=.002,r=.25)),(.25,pop(300))]
    elif has('咕噜'): P=[(0,gurgle(.8))]
    elif has('「铮」'): P=[(0,zither(392,.8)),(0,metal(1568,.3)*.4)]
    elif has('滴—滴'): P=[(0,sine(1000,.15,a=.005,r=.05)),(.35,sine(1000,.4,a=.005,r=.1))]
    elif has('哗啦'): P=[(i*.07,metal(1800+rng.uniform(-300,300),.15)*.6) for i in range(7)]+[(.5,thump(110,.3))]
    elif has('护盾展开'): P=[(0,sine(220,.6,660,a=.05,harm=(1,2,3),r=.2)*.6),(.1,hum(110,.8)*.5)]
    elif has('「嘘」'): P=[(0,noise(.7,2000,7000,a=.1,r=.3)*.6)]
    elif has('浪涛'): P=[(0,whoosh(1.1,100,1500))]
    elif has('古琴'): P=[(0,zither(196,1.0))]
    elif has('爆鸣'): P=[(0,bell(2093,.4)*.5),(.2,thump(80,.5)),(.2,noise(.5,100,1500,a=.002,r=.4)*.6)]
    elif has('闪粉','沙沙'): P=[(i*.04,bell(rng.uniform(2000,3500),.15)*.15) for i in range(15)]+[(0,noise(.9,3000,7000,a=.2,r=.3)*.2)]
    elif has('治疗'): P=[(i*.12,bell(SCALE[i*2],.6)*.5) for i in range(4)]
    elif has('「噗」'): P=[(0,noise(.3,100,1500,a=.002,r=.25)),(0,pop(250))]
    elif has('命中','嘭'): P=[(0,thump(100,.4))]
    else: raise SystemExit('no recipe: '+name+' '+d)
    total = min(1.1, max(at+len(s)/SR for at,s in P)+.02)
    y = mix(*P,total=total)
    if gentle: y = lp(y, 3500)          # 低年级：去尖锐高频
    y = y/ (np.abs(y).max()+1e-9) * .7
    nf = int(.015*SR); y[-nf:] *= np.linspace(1,0,nf)
    return y
def measure(path_or_raw, raw=False):
    args=['ffmpeg','-hide_banner','-nostats']+(['-f','s16le','-ar',str(SR),'-ac','1','-i','-'] if raw else ['-i',path_or_raw])+['-af','apad=whole_dur=0.5,ebur128=peak=true','-f','null','-']
    e=subprocess.run(args,input=path_or_raw if raw else None,capture_output=True).stderr.decode()
    summ=e[e.rindex('Summary:'):]
    I=float(re.search(r'I:\s+(-?[\d.]+|-inf) LUFS',summ).group(1)); TP=float(re.search(r'Peak:\s+(-?[\d.]+|-inf)',summ).group(1))
    return I,TP
def enc(y): return (np.clip(y,-1,1)*32767).astype('<i2').tobytes()
def level(y, lufs):
    """返回到达目标响度的信号；若被 -1 dBTP 限制，先用 tanh 软压缩瞬态再测（最多 4 次）。"""
    for _ in range(4):
        I,TP=measure(enc(y),True); need=lufs-I
        if TP+need <= -1.0: break
        y=np.tanh(2.5*y/np.abs(y).max())/np.tanh(2.5)*.7
    I,TP=measure(enc(y),True); g=min(lufs-I,-1.0-TP)
    return y*10**(g/20)
def write(y, path):
    subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-f','s16le','-ar',str(SR),'-ac','1','-i','-','-c:a','libmp3lame','-b:a','96k',path],input=enc(y),check=True)
def parse():
    rows=[]; stage=None
    for line in open(LIST,encoding='utf-8'):
        m=re.match(r'### (.+)',line)
        if m: stage=STAGE.get(m.group(1).strip()); continue
        if stage and line.startswith('|') and not line.startswith('| 角色') and not line.startswith('|---'):
            c=[x.strip() for x in line.strip().strip('|').split('|')]
            rows.append(dict(stage=stage,char=c[0],skill=c[1],sfx_desc=c[-1] if len(c)>=7 else c[-1]))
    cnt={}
    for r in rows:
        k=(r['stage'],CHAR[r['char']]); cnt[k]=cnt.get(k,0)+1
        r['id']=f"{r['stage']}_{CHAR[r['char']]}_{cnt[k]}"
    return rows
NAMES = {'k':'小班','p12':'小学1–2','p36':'小学3–6','j1':'初一','h1':'高一'}
def write_manifests(rows):
    """skills-manifest.json（技能 ID → 文件；小班带 kindergarten 字段）+ 把技能音效登记进 manifest.json（不重复）。"""
    sk = {}
    for r in rows:
        e = dict(stage=r['stage'], character=r['char'], name=r['skill'], file=f"skills/sfx_skill_{r['id']}.mp3")
        if r['stage'] == 'k': e['kindergarten'] = f"skills/kindergarten/sfx_skill_{r['id']}.mp3"
        sk[r['id']] = e
    man = {"version": "v0.3.7", "format": "mp3 mono 44.1kHz 96kbps",
           "loudness": {"standard": "-16 LUFS, TP<=-1 dBTP", "kindergarten": "standard -6 dB (~-22 LUFS)"},
           "naming": "sfx_skill_<stage>_<characterId>_<n>.mp3; stage=k|p12|p36|j1|h1, n=该角色在该学段清单中的顺序(1起)", "skills": sk}
    json.dump(man, open(os.path.join(ROOT, 'public/sfx/skills-manifest.json'), 'w'), ensure_ascii=False, indent=1)
    mp = os.path.join(ROOT, 'public/sfx/manifest.json'); m = json.load(open(mp))
    have = set(m['sfx'])
    for e in sk.values():
        for f in ([e['file']] + ([e['kindergarten']] if 'kindergarten' in e else [])):
            if f not in have: m['sfx'].append(f); have.add(f)
    json.dump(m, open(mp, 'w'), ensure_ascii=False, indent=1)
if __name__=='__main__':
    import sys
    rows=parse(); assert len(rows)==85, len(rows)
    if '--manifest-only' in sys.argv:   # 不重新合成，只按现有文件重建清单
        missing=[r['id'] for r in rows if not os.path.exists(os.path.join(OUT,f"sfx_skill_{r['id']}.mp3"))]
        assert not missing, missing
        write_manifests(rows); print('manifests ok', len(rows)); raise SystemExit
    os.makedirs(KG,exist_ok=True)
    for r in rows:
        gentle = r['stage'] in ('k','p12')
        y = recipe(r['sfx_desc'], gentle, r['id'])
        r['file']=f"sfx_skill_{r['id']}.mp3"; y=level(y,-16); write(y, os.path.join(OUT,r['file']))
        if r['stage']=='k': write(y*10**(-6/20), os.path.join(KG,r['file']))  # 与标准版完全相同，整体 -6 dB
    json.dump(rows, open('/tmp/skill_rows.json','w'), ensure_ascii=False)
    write_manifests(rows)
    print('ok', len(rows))
