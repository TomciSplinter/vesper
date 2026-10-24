import{a as h,b as m,c as E,d as wo,e as Pt,f as bo,h as yo}from"./chunk-NSMFLHL7.js";import{A as k,B as q,C as ee,D as f,F as mo,J as go,l as nt,o as u,p as Ae,s as Lt,t as fo,u as w,w as $}from"./chunk-7AGKTUNO.js";import"./chunk-JQD3OP6B.js";import{a as ii}from"./chunk-V7DVCJUY.js";import{A as K,B as uo,C as P,D as I,E as ze,F as po,G as b,H as _e,I as z,N as ho,P as x,V as Q,W as it,a as je,f as tt,p as ot,q as co,r as C,u as N,v as ae,x as rt,z as Wt}from"./chunk-7W2W3ZV4.js";import"./chunk-JAQGK5NV.js";import"./chunk-W4ZJUYDY.js";import"./chunk-YSXSLQLY.js";import"./chunk-BD6UBNAX.js";import{c as A,f as ri,p as a}from"./chunk-YEQCG7KL.js";var Lo=A((Jl,Wo)=>{a();Wo.exports=function(){return typeof Promise=="function"&&Promise.prototype&&Promise.prototype.then}});var ue=A(ye=>{a();var kt,ci=[0,26,44,70,100,134,172,196,242,292,346,404,466,532,581,655,733,815,901,991,1085,1156,1258,1364,1474,1588,1706,1828,1921,2051,2185,2323,2465,2611,2761,2876,3034,3196,3362,3532,3706];ye.getSymbolSize=function(e){if(!e)throw new Error('"version" cannot be null or undefined');if(e<1||e>40)throw new Error('"version" should be in range from 1 to 40');return e*4+17};ye.getSymbolTotalCodewords=function(e){return ci[e]};ye.getBCHDigit=function(t){let e=0;for(;t!==0;)e++,t>>>=1;return e};ye.setToSJISFunction=function(e){if(typeof e!="function")throw new Error('"toSJISFunc" is not a valid function.');kt=e};ye.isKanjiModeEnabled=function(){return typeof kt<"u"};ye.toSJIS=function(e){return kt(e)}});var ut=A(J=>{a();J.L={bit:1};J.M={bit:0};J.Q={bit:3};J.H={bit:2};function ui(t){if(typeof t!="string")throw new Error("Param is not a string");switch(t.toLowerCase()){case"l":case"low":return J.L;case"m":case"medium":return J.M;case"q":case"quartile":return J.Q;case"h":case"high":return J.H;default:throw new Error("Unknown EC Level: "+t)}}J.isValid=function(e){return e&&typeof e.bit<"u"&&e.bit>=0&&e.bit<4};J.from=function(e,o){if(J.isValid(e))return e;try{return ui(e)}catch{return o}}});var ko=A((oa,Bo)=>{a();function Po(){this.buffer=[],this.length=0}Po.prototype={get:function(t){let e=Math.floor(t/8);return(this.buffer[e]>>>7-t%8&1)===1},put:function(t,e){for(let o=0;o<e;o++)this.putBit((t>>>e-o-1&1)===1)},getLengthInBits:function(){return this.length},putBit:function(t){let e=Math.floor(this.length/8);this.buffer.length<=e&&this.buffer.push(0),t&&(this.buffer[e]|=128>>>this.length%8),this.length++}};Bo.exports=Po});var Oo=A((ia,No)=>{a();function Ve(t){if(!t||t<1)throw new Error("BitMatrix size must be defined and greater than 0");this.size=t,this.data=new Uint8Array(t*t),this.reservedBit=new Uint8Array(t*t)}Ve.prototype.set=function(t,e,o,i){let n=t*this.size+e;this.data[n]=o,i&&(this.reservedBit[n]=!0)};Ve.prototype.get=function(t,e){return this.data[t*this.size+e]};Ve.prototype.xor=function(t,e,o){this.data[t*this.size+e]^=o};Ve.prototype.isReserved=function(t,e){return this.reservedBit[t*this.size+e]};No.exports=Ve});var Do=A(dt=>{a();var di=ue().getSymbolSize;dt.getRowColCoords=function(e){if(e===1)return[];let o=Math.floor(e/7)+2,i=di(e),n=i===145?26:Math.ceil((i-13)/(2*o-2))*2,r=[i-7];for(let s=1;s<o-1;s++)r[s]=r[s-1]-n;return r.push(6),r.reverse()};dt.getPositions=function(e){let o=[],i=dt.getRowColCoords(e),n=i.length;for(let r=0;r<n;r++)for(let s=0;s<n;s++)r===0&&s===0||r===0&&s===n-1||r===n-1&&s===0||o.push([i[r],i[s]]);return o}});var jo=A(Uo=>{a();var pi=ue().getSymbolSize,Mo=7;Uo.getPositions=function(e){let o=pi(e);return[[0,0],[o-Mo,0],[0,o-Mo]]}});var zo=A(W=>{a();W.Patterns={PATTERN000:0,PATTERN001:1,PATTERN010:2,PATTERN011:3,PATTERN100:4,PATTERN101:5,PATTERN110:6,PATTERN111:7};var xe={N1:3,N2:3,N3:40,N4:10};W.isValid=function(e){return e!=null&&e!==""&&!isNaN(e)&&e>=0&&e<=7};W.from=function(e){return W.isValid(e)?parseInt(e,10):void 0};W.getPenaltyN1=function(e){let o=e.size,i=0,n=0,r=0,s=null,l=null;for(let c=0;c<o;c++){n=r=0,s=l=null;for(let g=0;g<o;g++){let y=e.get(c,g);y===s?n++:(n>=5&&(i+=xe.N1+(n-5)),s=y,n=1),y=e.get(g,c),y===l?r++:(r>=5&&(i+=xe.N1+(r-5)),l=y,r=1)}n>=5&&(i+=xe.N1+(n-5)),r>=5&&(i+=xe.N1+(r-5))}return i};W.getPenaltyN2=function(e){let o=e.size,i=0;for(let n=0;n<o-1;n++)for(let r=0;r<o-1;r++){let s=e.get(n,r)+e.get(n,r+1)+e.get(n+1,r)+e.get(n+1,r+1);(s===4||s===0)&&i++}return i*xe.N2};W.getPenaltyN3=function(e){let o=e.size,i=0,n=0,r=0;for(let s=0;s<o;s++){n=r=0;for(let l=0;l<o;l++)n=n<<1&2047|e.get(s,l),l>=10&&(n===1488||n===93)&&i++,r=r<<1&2047|e.get(l,s),l>=10&&(r===1488||r===93)&&i++}return i*xe.N3};W.getPenaltyN4=function(e){let o=0,i=e.data.length;for(let r=0;r<i;r++)o+=e.data[r];return Math.abs(Math.ceil(o*100/i/5)-10)*xe.N4};function hi(t,e,o){switch(t){case W.Patterns.PATTERN000:return(e+o)%2===0;case W.Patterns.PATTERN001:return e%2===0;case W.Patterns.PATTERN010:return o%3===0;case W.Patterns.PATTERN011:return(e+o)%3===0;case W.Patterns.PATTERN100:return(Math.floor(e/2)+Math.floor(o/3))%2===0;case W.Patterns.PATTERN101:return e*o%2+e*o%3===0;case W.Patterns.PATTERN110:return(e*o%2+e*o%3)%2===0;case W.Patterns.PATTERN111:return(e*o%3+(e+o)%2)%2===0;default:throw new Error("bad maskPattern:"+t)}}W.applyMask=function(e,o){let i=o.size;for(let n=0;n<i;n++)for(let r=0;r<i;r++)o.isReserved(r,n)||o.xor(r,n,hi(e,r,n))};W.getBestMask=function(e,o){let i=Object.keys(W.Patterns).length,n=0,r=1/0;for(let s=0;s<i;s++){o(s),W.applyMask(s,e);let l=W.getPenaltyN1(e)+W.getPenaltyN2(e)+W.getPenaltyN3(e)+W.getPenaltyN4(e);W.applyMask(s,e),l<r&&(r=l,n=s)}return n}});var Ot=A(Nt=>{a();var de=ut(),pt=[1,1,1,1,1,1,1,1,1,1,2,2,1,2,2,4,1,2,4,4,2,4,4,4,2,4,6,5,2,4,6,6,2,5,8,8,4,5,8,8,4,5,8,11,4,8,10,11,4,9,12,16,4,9,16,16,6,10,12,18,6,10,17,16,6,11,16,19,6,13,18,21,7,14,21,25,8,16,20,25,8,17,23,25,9,17,23,34,9,18,25,30,10,20,27,32,12,21,29,35,12,23,34,37,12,25,34,40,13,26,35,42,14,28,38,45,15,29,40,48,16,31,43,51,17,33,45,54,18,35,48,57,19,37,51,60,19,38,53,63,20,40,56,66,21,43,59,70,22,45,62,74,24,47,65,77,25,49,68,81],ht=[7,10,13,17,10,16,22,28,15,26,36,44,20,36,52,64,26,48,72,88,36,64,96,112,40,72,108,130,48,88,132,156,60,110,160,192,72,130,192,224,80,150,224,264,96,176,260,308,104,198,288,352,120,216,320,384,132,240,360,432,144,280,408,480,168,308,448,532,180,338,504,588,196,364,546,650,224,416,600,700,224,442,644,750,252,476,690,816,270,504,750,900,300,560,810,960,312,588,870,1050,336,644,952,1110,360,700,1020,1200,390,728,1050,1260,420,784,1140,1350,450,812,1200,1440,480,868,1290,1530,510,924,1350,1620,540,980,1440,1710,570,1036,1530,1800,570,1064,1590,1890,600,1120,1680,1980,630,1204,1770,2100,660,1260,1860,2220,720,1316,1950,2310,750,1372,2040,2430];Nt.getBlocksCount=function(e,o){switch(o){case de.L:return pt[(e-1)*4+0];case de.M:return pt[(e-1)*4+1];case de.Q:return pt[(e-1)*4+2];case de.H:return pt[(e-1)*4+3];default:return}};Nt.getTotalCodewordsCount=function(e,o){switch(o){case de.L:return ht[(e-1)*4+0];case de.M:return ht[(e-1)*4+1];case de.Q:return ht[(e-1)*4+2];case de.H:return ht[(e-1)*4+3];default:return}}});var qo=A(mt=>{a();var He=new Uint8Array(512),ft=new Uint8Array(256);(function(){let e=1;for(let o=0;o<255;o++)He[o]=e,ft[e]=o,e<<=1,e&256&&(e^=285);for(let o=255;o<512;o++)He[o]=He[o-255]})();mt.log=function(e){if(e<1)throw new Error("log("+e+")");return ft[e]};mt.exp=function(e){return He[e]};mt.mul=function(e,o){return e===0||o===0?0:He[ft[e]+ft[o]]}});var Fo=A(Ke=>{a();var Dt=qo();Ke.mul=function(e,o){let i=new Uint8Array(e.length+o.length-1);for(let n=0;n<e.length;n++)for(let r=0;r<o.length;r++)i[n+r]^=Dt.mul(e[n],o[r]);return i};Ke.mod=function(e,o){let i=new Uint8Array(e);for(;i.length-o.length>=0;){let n=i[0];for(let s=0;s<o.length;s++)i[s]^=Dt.mul(o[s],n);let r=0;for(;r<i.length&&i[r]===0;)r++;i=i.slice(r)}return i};Ke.generateECPolynomial=function(e){let o=new Uint8Array([1]);for(let i=0;i<e;i++)o=Ke.mul(o,new Uint8Array([1,Dt.exp(i)]));return o}});var Ko=A((ba,Ho)=>{a();var Vo=Fo();function Mt(t){this.genPoly=void 0,this.degree=t,this.degree&&this.initialize(this.degree)}Mt.prototype.initialize=function(e){this.degree=e,this.genPoly=Vo.generateECPolynomial(this.degree)};Mt.prototype.encode=function(e){if(!this.genPoly)throw new Error("Encoder not initialized");let o=new Uint8Array(e.length+this.degree);o.set(e);let i=Vo.mod(o,this.genPoly),n=this.degree-i.length;if(n>0){let r=new Uint8Array(this.degree);return r.set(i,n),r}return i};Ho.exports=Mt});var Ut=A(Go=>{a();Go.isValid=function(e){return!isNaN(e)&&e>=1&&e<=40}});var jt=A(ne=>{a();var Qo="[0-9]+",fi="[A-Z $%*+\\-./:]+",Ge="(?:[u3000-u303F]|[u3040-u309F]|[u30A0-u30FF]|[uFF00-uFFEF]|[u4E00-u9FAF]|[u2605-u2606]|[u2190-u2195]|u203B|[u2010u2015u2018u2019u2025u2026u201Cu201Du2225u2260]|[u0391-u0451]|[u00A7u00A8u00B1u00B4u00D7u00F7])+";Ge=Ge.replace(/u/g,"\\u");var mi="(?:(?![A-Z0-9 $%*+\\-./:]|"+Ge+`)(?:.|[\r
]))+`;ne.KANJI=new RegExp(Ge,"g");ne.BYTE_KANJI=new RegExp("[^A-Z0-9 $%*+\\-./:]+","g");ne.BYTE=new RegExp(mi,"g");ne.NUMERIC=new RegExp(Qo,"g");ne.ALPHANUMERIC=new RegExp(fi,"g");var gi=new RegExp("^"+Ge+"$"),wi=new RegExp("^"+Qo+"$"),bi=new RegExp("^[A-Z0-9 $%*+\\-./:]+$");ne.testKanji=function(e){return gi.test(e)};ne.testNumeric=function(e){return wi.test(e)};ne.testAlphanumeric=function(e){return bi.test(e)}});var pe=A(M=>{a();var yi=Ut(),zt=jt();M.NUMERIC={id:"Numeric",bit:1,ccBits:[10,12,14]};M.ALPHANUMERIC={id:"Alphanumeric",bit:2,ccBits:[9,11,13]};M.BYTE={id:"Byte",bit:4,ccBits:[8,16,16]};M.KANJI={id:"Kanji",bit:8,ccBits:[8,10,12]};M.MIXED={bit:-1};M.getCharCountIndicator=function(e,o){if(!e.ccBits)throw new Error("Invalid mode: "+e);if(!yi.isValid(o))throw new Error("Invalid version: "+o);return o>=1&&o<10?e.ccBits[0]:o<27?e.ccBits[1]:e.ccBits[2]};M.getBestModeForData=function(e){return zt.testNumeric(e)?M.NUMERIC:zt.testAlphanumeric(e)?M.ALPHANUMERIC:zt.testKanji(e)?M.KANJI:M.BYTE};M.toString=function(e){if(e&&e.id)return e.id;throw new Error("Invalid mode")};M.isValid=function(e){return e&&e.bit&&e.ccBits};function xi(t){if(typeof t!="string")throw new Error("Param is not a string");switch(t.toLowerCase()){case"numeric":return M.NUMERIC;case"alphanumeric":return M.ALPHANUMERIC;case"kanji":return M.KANJI;case"byte":return M.BYTE;default:throw new Error("Unknown mode: "+t)}}M.from=function(e,o){if(M.isValid(e))return e;try{return xi(e)}catch{return o}}});var er=A(Ce=>{a();var gt=ue(),Ci=Ot(),Jo=ut(),he=pe(),qt=Ut(),Xo=7973,Yo=gt.getBCHDigit(Xo);function $i(t,e,o){for(let i=1;i<=40;i++)if(e<=Ce.getCapacity(i,o,t))return i}function Zo(t,e){return he.getCharCountIndicator(t,e)+4}function vi(t,e){let o=0;return t.forEach(function(i){let n=Zo(i.mode,e);o+=n+i.getBitsLength()}),o}function Ei(t,e){for(let o=1;o<=40;o++)if(vi(t,o)<=Ce.getCapacity(o,e,he.MIXED))return o}Ce.from=function(e,o){return qt.isValid(e)?parseInt(e,10):o};Ce.getCapacity=function(e,o,i){if(!qt.isValid(e))throw new Error("Invalid QR Code version");typeof i>"u"&&(i=he.BYTE);let n=gt.getSymbolTotalCodewords(e),r=Ci.getTotalCodewordsCount(e,o),s=(n-r)*8;if(i===he.MIXED)return s;let l=s-Zo(i,e);switch(i){case he.NUMERIC:return Math.floor(l/10*3);case he.ALPHANUMERIC:return Math.floor(l/11*2);case he.KANJI:return Math.floor(l/13);case he.BYTE:default:return Math.floor(l/8)}};Ce.getBestVersionForData=function(e,o){let i,n=Jo.from(o,Jo.M);if(Array.isArray(e)){if(e.length>1)return Ei(e,n);if(e.length===0)return 1;i=e[0]}else i=e;return $i(i.mode,i.getLength(),n)};Ce.getEncodedBits=function(e){if(!qt.isValid(e)||e<7)throw new Error("Invalid QR Code version");let o=e<<12;for(;gt.getBCHDigit(o)-Yo>=0;)o^=Xo<<gt.getBCHDigit(o)-Yo;return e<<12|o}});var ir=A(rr=>{a();var Ft=ue(),or=1335,Ri=21522,tr=Ft.getBCHDigit(or);rr.getEncodedBits=function(e,o){let i=e.bit<<3|o,n=i<<10;for(;Ft.getBCHDigit(n)-tr>=0;)n^=or<<Ft.getBCHDigit(n)-tr;return(i<<10|n)^Ri}});var sr=A((Ia,nr)=>{a();var Si=pe();function Pe(t){this.mode=Si.NUMERIC,this.data=t.toString()}Pe.getBitsLength=function(e){return 10*Math.floor(e/3)+(e%3?e%3*3+1:0)};Pe.prototype.getLength=function(){return this.data.length};Pe.prototype.getBitsLength=function(){return Pe.getBitsLength(this.data.length)};Pe.prototype.write=function(e){let o,i,n;for(o=0;o+3<=this.data.length;o+=3)i=this.data.substr(o,3),n=parseInt(i,10),e.put(n,10);let r=this.data.length-o;r>0&&(i=this.data.substr(o),n=parseInt(i,10),e.put(n,r*3+1))};nr.exports=Pe});var ar=A((La,lr)=>{a();var _i=pe(),Vt=["0","1","2","3","4","5","6","7","8","9","A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z"," ","$","%","*","+","-",".","/",":"];function Be(t){this.mode=_i.ALPHANUMERIC,this.data=t}Be.getBitsLength=function(e){return 11*Math.floor(e/2)+6*(e%2)};Be.prototype.getLength=function(){return this.data.length};Be.prototype.getBitsLength=function(){return Be.getBitsLength(this.data.length)};Be.prototype.write=function(e){let o;for(o=0;o+2<=this.data.length;o+=2){let i=Vt.indexOf(this.data[o])*45;i+=Vt.indexOf(this.data[o+1]),e.put(i,11)}this.data.length%2&&e.put(Vt.indexOf(this.data[o]),6)};lr.exports=Be});var ur=A((Ba,cr)=>{"use strict";a();cr.exports=function(e){for(var o=[],i=e.length,n=0;n<i;n++){var r=e.charCodeAt(n);if(r>=55296&&r<=56319&&i>n+1){var s=e.charCodeAt(n+1);s>=56320&&s<=57343&&(r=(r-55296)*1024+s-56320+65536,n+=1)}if(r<128){o.push(r);continue}if(r<2048){o.push(r>>6|192),o.push(r&63|128);continue}if(r<55296||r>=57344&&r<65536){o.push(r>>12|224),o.push(r>>6&63|128),o.push(r&63|128);continue}if(r>=65536&&r<=1114111){o.push(r>>18|240),o.push(r>>12&63|128),o.push(r>>6&63|128),o.push(r&63|128);continue}o.push(239,191,189)}return new Uint8Array(o).buffer}});var pr=A((Na,dr)=>{a();var Ai=ur(),Ti=pe();function ke(t){this.mode=Ti.BYTE,typeof t=="string"&&(t=Ai(t)),this.data=new Uint8Array(t)}ke.getBitsLength=function(e){return e*8};ke.prototype.getLength=function(){return this.data.length};ke.prototype.getBitsLength=function(){return ke.getBitsLength(this.data.length)};ke.prototype.write=function(t){for(let e=0,o=this.data.length;e<o;e++)t.put(this.data[e],8)};dr.exports=ke});var fr=A((Da,hr)=>{a();var Ii=pe(),Wi=ue();function Ne(t){this.mode=Ii.KANJI,this.data=t}Ne.getBitsLength=function(e){return e*13};Ne.prototype.getLength=function(){return this.data.length};Ne.prototype.getBitsLength=function(){return Ne.getBitsLength(this.data.length)};Ne.prototype.write=function(t){let e;for(e=0;e<this.data.length;e++){let o=Wi.toSJIS(this.data[e]);if(o>=33088&&o<=40956)o-=33088;else if(o>=57408&&o<=60351)o-=49472;else throw new Error("Invalid SJIS character: "+this.data[e]+`
Make sure your charset is UTF-8`);o=(o>>>8&255)*192+(o&255),t.put(o,13)}};hr.exports=Ne});var $r=A(Oe=>{a();var R=pe(),wr=sr(),br=ar(),yr=pr(),xr=fr(),Qe=jt(),wt=ue(),Li=ii();function mr(t){return unescape(encodeURIComponent(t)).length}function Je(t,e,o){let i=[],n;for(;(n=t.exec(o))!==null;)i.push({data:n[0],index:n.index,mode:e,length:n[0].length});return i}function Cr(t){let e=Je(Qe.NUMERIC,R.NUMERIC,t),o=Je(Qe.ALPHANUMERIC,R.ALPHANUMERIC,t),i,n;return wt.isKanjiModeEnabled()?(i=Je(Qe.BYTE,R.BYTE,t),n=Je(Qe.KANJI,R.KANJI,t)):(i=Je(Qe.BYTE_KANJI,R.BYTE,t),n=[]),e.concat(o,i,n).sort(function(s,l){return s.index-l.index}).map(function(s){return{data:s.data,mode:s.mode,length:s.length}})}function Ht(t,e){switch(e){case R.NUMERIC:return wr.getBitsLength(t);case R.ALPHANUMERIC:return br.getBitsLength(t);case R.KANJI:return xr.getBitsLength(t);case R.BYTE:return yr.getBitsLength(t)}}function Pi(t){return t.reduce(function(e,o){let i=e.length-1>=0?e[e.length-1]:null;return i&&i.mode===o.mode?(e[e.length-1].data+=o.data,e):(e.push(o),e)},[])}function Bi(t){let e=[];for(let o=0;o<t.length;o++){let i=t[o];switch(i.mode){case R.NUMERIC:e.push([i,{data:i.data,mode:R.ALPHANUMERIC,length:i.length},{data:i.data,mode:R.BYTE,length:i.length}]);break;case R.ALPHANUMERIC:e.push([i,{data:i.data,mode:R.BYTE,length:i.length}]);break;case R.KANJI:e.push([i,{data:i.data,mode:R.BYTE,length:mr(i.data)}]);break;case R.BYTE:e.push([{data:i.data,mode:R.BYTE,length:mr(i.data)}])}}return e}function ki(t,e){let o={},i={start:{}},n=["start"];for(let r=0;r<t.length;r++){let s=t[r],l=[];for(let c=0;c<s.length;c++){let g=s[c],y=""+r+c;l.push(y),o[y]={node:g,lastCount:0},i[y]={};for(let O=0;O<n.length;O++){let T=n[O];o[T]&&o[T].node.mode===g.mode?(i[T][y]=Ht(o[T].lastCount+g.length,g.mode)-Ht(o[T].lastCount,g.mode),o[T].lastCount+=g.length):(o[T]&&(o[T].lastCount=g.length),i[T][y]=Ht(g.length,g.mode)+4+R.getCharCountIndicator(g.mode,e))}}n=l}for(let r=0;r<n.length;r++)i[n[r]].end=0;return{map:i,table:o}}function gr(t,e){let o,i=R.getBestModeForData(t);if(o=R.from(e,i),o!==R.BYTE&&o.bit<i.bit)throw new Error('"'+t+'" cannot be encoded with mode '+R.toString(o)+`.
 Suggested mode is: `+R.toString(i));switch(o===R.KANJI&&!wt.isKanjiModeEnabled()&&(o=R.BYTE),o){case R.NUMERIC:return new wr(t);case R.ALPHANUMERIC:return new br(t);case R.KANJI:return new xr(t);case R.BYTE:return new yr(t)}}Oe.fromArray=function(e){return e.reduce(function(o,i){return typeof i=="string"?o.push(gr(i,null)):i.data&&o.push(gr(i.data,i.mode)),o},[])};Oe.fromString=function(e,o){let i=Cr(e,wt.isKanjiModeEnabled()),n=Bi(i),r=ki(n,o),s=Li.find_path(r.map,"start","end"),l=[];for(let c=1;c<s.length-1;c++)l.push(r.table[s[c]].node);return Oe.fromArray(Pi(l))};Oe.rawSplit=function(e){return Oe.fromArray(Cr(e,wt.isKanjiModeEnabled()))}});var Er=A(vr=>{a();var yt=ue(),Kt=ut(),Ni=ko(),Oi=Oo(),Di=Do(),Mi=jo(),Jt=zo(),Yt=Ot(),Ui=Ko(),bt=er(),ji=ir(),zi=pe(),Gt=$r();function qi(t,e){let o=t.size,i=Mi.getPositions(e);for(let n=0;n<i.length;n++){let r=i[n][0],s=i[n][1];for(let l=-1;l<=7;l++)if(!(r+l<=-1||o<=r+l))for(let c=-1;c<=7;c++)s+c<=-1||o<=s+c||(l>=0&&l<=6&&(c===0||c===6)||c>=0&&c<=6&&(l===0||l===6)||l>=2&&l<=4&&c>=2&&c<=4?t.set(r+l,s+c,!0,!0):t.set(r+l,s+c,!1,!0))}}function Fi(t){let e=t.size;for(let o=8;o<e-8;o++){let i=o%2===0;t.set(o,6,i,!0),t.set(6,o,i,!0)}}function Vi(t,e){let o=Di.getPositions(e);for(let i=0;i<o.length;i++){let n=o[i][0],r=o[i][1];for(let s=-2;s<=2;s++)for(let l=-2;l<=2;l++)s===-2||s===2||l===-2||l===2||s===0&&l===0?t.set(n+s,r+l,!0,!0):t.set(n+s,r+l,!1,!0)}}function Hi(t,e){let o=t.size,i=bt.getEncodedBits(e),n,r,s;for(let l=0;l<18;l++)n=Math.floor(l/3),r=l%3+o-8-3,s=(i>>l&1)===1,t.set(n,r,s,!0),t.set(r,n,s,!0)}function Qt(t,e,o){let i=t.size,n=ji.getEncodedBits(e,o),r,s;for(r=0;r<15;r++)s=(n>>r&1)===1,r<6?t.set(r,8,s,!0):r<8?t.set(r+1,8,s,!0):t.set(i-15+r,8,s,!0),r<8?t.set(8,i-r-1,s,!0):r<9?t.set(8,15-r-1+1,s,!0):t.set(8,15-r-1,s,!0);t.set(i-8,8,1,!0)}function Ki(t,e){let o=t.size,i=-1,n=o-1,r=7,s=0;for(let l=o-1;l>0;l-=2)for(l===6&&l--;;){for(let c=0;c<2;c++)if(!t.isReserved(n,l-c)){let g=!1;s<e.length&&(g=(e[s]>>>r&1)===1),t.set(n,l-c,g),r--,r===-1&&(s++,r=7)}if(n+=i,n<0||o<=n){n-=i,i=-i;break}}}function Gi(t,e,o){let i=new Ni;o.forEach(function(c){i.put(c.mode.bit,4),i.put(c.getLength(),zi.getCharCountIndicator(c.mode,t)),c.write(i)});let n=yt.getSymbolTotalCodewords(t),r=Yt.getTotalCodewordsCount(t,e),s=(n-r)*8;for(i.getLengthInBits()+4<=s&&i.put(0,4);i.getLengthInBits()%8!==0;)i.putBit(0);let l=(s-i.getLengthInBits())/8;for(let c=0;c<l;c++)i.put(c%2?17:236,8);return Qi(i,t,e)}function Qi(t,e,o){let i=yt.getSymbolTotalCodewords(e),n=Yt.getTotalCodewordsCount(e,o),r=i-n,s=Yt.getBlocksCount(e,o),l=i%s,c=s-l,g=Math.floor(i/s),y=Math.floor(r/s),O=y+1,T=g-y,G=new Ui(T),H=0,S=new Array(s),v=new Array(s),U=0,_=new Uint8Array(t.buffer);for(let Se=0;Se<s;Se++){let It=Se<c?y:O;S[Se]=_.slice(H,H+It),v[Se]=G.encode(S[Se]),H+=It,U=Math.max(U,It)}let j=new Uint8Array(i),B=0,D,ie;for(D=0;D<U;D++)for(ie=0;ie<s;ie++)D<S[ie].length&&(j[B++]=S[ie][D]);for(D=0;D<T;D++)for(ie=0;ie<s;ie++)j[B++]=v[ie][D];return j}function Ji(t,e,o,i){let n;if(Array.isArray(t))n=Gt.fromArray(t);else if(typeof t=="string"){let g=e;if(!g){let y=Gt.rawSplit(t);g=bt.getBestVersionForData(y,o)}n=Gt.fromString(t,g||40)}else throw new Error("Invalid data");let r=bt.getBestVersionForData(n,o);if(!r)throw new Error("The amount of data is too big to be stored in a QR Code");if(!e)e=r;else if(e<r)throw new Error(`
The chosen QR Code version cannot contain this amount of data.
Minimum version required to store current data is: `+r+`.
`);let s=Gi(e,o,n),l=yt.getSymbolSize(e),c=new Oi(l);return qi(c,e),Fi(c),Vi(c,e),Qt(c,o,0),e>=7&&Hi(c,e),Ki(c,s),isNaN(i)&&(i=Jt.getBestMask(c,Qt.bind(null,c,o))),Jt.applyMask(i,c),Qt(c,o,i),{modules:c,version:e,errorCorrectionLevel:o,maskPattern:i,segments:n}}vr.create=function(e,o){if(typeof e>"u"||e==="")throw new Error("No input text");let i=Kt.M,n,r;return typeof o<"u"&&(i=Kt.from(o.errorCorrectionLevel,Kt.M),n=bt.from(o.version),r=Jt.from(o.maskPattern),o.toSJISFunc&&yt.setToSJISFunction(o.toSJISFunc)),Ji(e,n,i,r)}});var Xt=A($e=>{a();function Rr(t){if(typeof t=="number"&&(t=t.toString()),typeof t!="string")throw new Error("Color should be defined as hex string");let e=t.slice().replace("#","").split("");if(e.length<3||e.length===5||e.length>8)throw new Error("Invalid hex color: "+t);(e.length===3||e.length===4)&&(e=Array.prototype.concat.apply([],e.map(function(i){return[i,i]}))),e.length===6&&e.push("F","F");let o=parseInt(e.join(""),16);return{r:o>>24&255,g:o>>16&255,b:o>>8&255,a:o&255,hex:"#"+e.slice(0,6).join("")}}$e.getOptions=function(e){e||(e={}),e.color||(e.color={});let o=typeof e.margin>"u"||e.margin===null||e.margin<0?4:e.margin,i=e.width&&e.width>=21?e.width:void 0,n=e.scale||4;return{width:i,scale:i?4:n,margin:o,color:{dark:Rr(e.color.dark||"#000000ff"),light:Rr(e.color.light||"#ffffffff")},type:e.type,rendererOpts:e.rendererOpts||{}}};$e.getScale=function(e,o){return o.width&&o.width>=e+o.margin*2?o.width/(e+o.margin*2):o.scale};$e.getImageWidth=function(e,o){let i=$e.getScale(e,o);return Math.floor((e+o.margin*2)*i)};$e.qrToImageData=function(e,o,i){let n=o.modules.size,r=o.modules.data,s=$e.getScale(n,i),l=Math.floor((n+i.margin*2)*s),c=i.margin*s,g=[i.color.light,i.color.dark];for(let y=0;y<l;y++)for(let O=0;O<l;O++){let T=(y*l+O)*4,G=i.color.light;if(y>=c&&O>=c&&y<l-c&&O<l-c){let H=Math.floor((y-c)/s),S=Math.floor((O-c)/s);G=g[r[H*n+S]?1:0]}e[T++]=G.r,e[T++]=G.g,e[T++]=G.b,e[T]=G.a}}});var Sr=A(xt=>{a();var Zt=Xt();function Yi(t,e,o){t.clearRect(0,0,e.width,e.height),e.style||(e.style={}),e.height=o,e.width=o,e.style.height=o+"px",e.style.width=o+"px"}function Xi(){try{return document.createElement("canvas")}catch{throw new Error("You need to specify a canvas element")}}xt.render=function(e,o,i){let n=i,r=o;typeof n>"u"&&(!o||!o.getContext)&&(n=o,o=void 0),o||(r=Xi()),n=Zt.getOptions(n);let s=Zt.getImageWidth(e.modules.size,n),l=r.getContext("2d"),c=l.createImageData(s,s);return Zt.qrToImageData(c.data,e,n),Yi(l,r,s),l.putImageData(c,0,0),r};xt.renderToDataURL=function(e,o,i){let n=i;typeof n>"u"&&(!o||!o.getContext)&&(n=o,o=void 0),n||(n={});let r=xt.render(e,o,n),s=n.type||"image/png",l=n.rendererOpts||{};return r.toDataURL(s,l.quality)}});var Tr=A(Ar=>{a();var Zi=Xt();function _r(t,e){let o=t.a/255,i=e+'="'+t.hex+'"';return o<1?i+" "+e+'-opacity="'+o.toFixed(2).slice(1)+'"':i}function eo(t,e,o){let i=t+e;return typeof o<"u"&&(i+=" "+o),i}function en(t,e,o){let i="",n=0,r=!1,s=0;for(let l=0;l<t.length;l++){let c=Math.floor(l%e),g=Math.floor(l/e);!c&&!r&&(r=!0),t[l]?(s++,l>0&&c>0&&t[l-1]||(i+=r?eo("M",c+o,.5+g+o):eo("m",n,0),n=0,r=!1),c+1<e&&t[l+1]||(i+=eo("h",s),s=0)):n++}return i}Ar.render=function(e,o,i){let n=Zi.getOptions(o),r=e.modules.size,s=e.modules.data,l=r+n.margin*2,c=n.color.light.a?"<path "+_r(n.color.light,"fill")+' d="M0 0h'+l+"v"+l+'H0z"/>':"",g="<path "+_r(n.color.dark,"stroke")+' d="'+en(s,r,n.margin)+'"/>',y='viewBox="0 0 '+l+" "+l+'"',T='<svg xmlns="http://www.w3.org/2000/svg" '+(n.width?'width="'+n.width+'" height="'+n.width+'" ':"")+y+' shape-rendering="crispEdges">'+c+g+`</svg>
`;return typeof i=="function"&&i(null,T),T}});var Wr=A(Ye=>{a();var tn=Lo(),to=Er(),Ir=Sr(),on=Tr();function oo(t,e,o,i,n){let r=[].slice.call(arguments,1),s=r.length,l=typeof r[s-1]=="function";if(!l&&!tn())throw new Error("Callback required as last argument");if(l){if(s<2)throw new Error("Too few arguments provided");s===2?(n=o,o=e,e=i=void 0):s===3&&(e.getContext&&typeof n>"u"?(n=i,i=void 0):(n=i,i=o,o=e,e=void 0))}else{if(s<1)throw new Error("Too few arguments provided");return s===1?(o=e,e=i=void 0):s===2&&!e.getContext&&(i=o,o=e,e=void 0),new Promise(function(c,g){try{let y=to.create(o,i);c(t(y,e,i))}catch(y){g(y)}})}try{let c=to.create(o,i);n(null,t(c,e,i))}catch(c){n(c)}}Ye.create=to.create;Ye.toCanvas=oo.bind(null,Ir.render);Ye.toDataURL=oo.bind(null,Ir.renderToDataURL);Ye.toString=oo.bind(null,function(t,e,o){return on.render(t,o)})});a();a();a();var Te=function(t,e,o,i){var n=arguments.length,r=n<3?e:i===null?i=Object.getOwnPropertyDescriptor(e,o):i,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")r=Reflect.decorate(t,e,o,i);else for(var l=t.length-1;l>=0;l--)(s=t[l])&&(r=(n<3?s(r):n>3?s(e,o,r):s(e,o))||r);return n>3&&r&&Object.defineProperty(e,o,r),r},me=class extends w{constructor(){super(),this.unsubscribe=[],this.tabIdx=void 0,this.connectors=z.state.connectors,this.count=I.state.count,this.filteredCount=I.state.filteredWallets.length,this.isFetchingRecommendedWallets=I.state.isFetchingRecommendedWallets,this.unsubscribe.push(z.subscribeKey("connectors",e=>this.connectors=e),I.subscribeKey("count",e=>this.count=e),I.subscribeKey("filteredWallets",e=>this.filteredCount=e.length),I.subscribeKey("isFetchingRecommendedWallets",e=>this.isFetchingRecommendedWallets=e))}disconnectedCallback(){this.unsubscribe.forEach(e=>e())}render(){let e=this.connectors.find(g=>g.id==="walletConnect"),{allWallets:o}=N.state;if(!e||o==="HIDE"||o==="ONLY_MOBILE"&&!C.isMobile())return null;let i=I.state.featured.length,n=this.count+i,r=n<10?n:Math.floor(n/10)*10,s=this.filteredCount>0?this.filteredCount:r,l=`${s}`;this.filteredCount>0?l=`${this.filteredCount}`:s<n&&(l=`${s}+`);let c=x.hasAnyConnection(je.CONNECTOR_ID.WALLET_CONNECT);return u`
      <wui-list-wallet
        name="Search Wallet"
        walletIcon="search"
        showAllWallets
        @click=${this.onAllWallets.bind(this)}
        tagLabel=${l}
        tagVariant="info"
        data-testid="all-wallets"
        tabIdx=${E(this.tabIdx)}
        .loading=${this.isFetchingRecommendedWallets}
        ?disabled=${c}
        size="sm"
      ></wui-list-wallet>
    `}onAllWallets(){P.sendEvent({type:"track",event:"CLICK_ALL_WALLETS"}),b.push("AllWallets",{redirectView:b.state.data?.redirectView})}};Te([h()],me.prototype,"tabIdx",void 0);Te([m()],me.prototype,"connectors",void 0);Te([m()],me.prototype,"count",void 0);Te([m()],me.prototype,"filteredCount",void 0);Te([m()],me.prototype,"isFetchingRecommendedWallets",void 0);me=Te([f("w3m-all-wallets-widget")],me);a();a();var xo=$`
  :host {
    margin-top: ${({spacing:t})=>t[1]};
  }
  wui-separator {
    margin: ${({spacing:t})=>t[3]} calc(${({spacing:t})=>t[3]} * -1)
      ${({spacing:t})=>t[2]} calc(${({spacing:t})=>t[3]} * -1);
    width: calc(100% + ${({spacing:t})=>t[3]} * 2);
  }
`;var Ie=function(t,e,o,i){var n=arguments.length,r=n<3?e:i===null?i=Object.getOwnPropertyDescriptor(e,o):i,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")r=Reflect.decorate(t,e,o,i);else for(var l=t.length-1;l>=0;l--)(s=t[l])&&(r=(n<3?s(r):n>3?s(e,o,r):s(e,o))||r);return n>3&&r&&Object.defineProperty(e,o,r),r},ce=class extends w{constructor(){super(),this.unsubscribe=[],this.explorerWallets=I.state.explorerWallets,this.connections=x.state.connections,this.connectorImages=Wt.state.connectorImages,this.loadingTelegram=!1,this.unsubscribe.push(x.subscribeKey("connections",e=>this.connections=e),Wt.subscribeKey("connectorImages",e=>this.connectorImages=e),I.subscribeKey("explorerFilteredWallets",e=>{this.explorerWallets=e?.length?e:I.state.explorerWallets}),I.subscribeKey("explorerWallets",e=>{this.explorerWallets?.length||(this.explorerWallets=e)})),C.isTelegram()&&C.isIos()&&(this.loadingTelegram=!x.state.wcUri,this.unsubscribe.push(x.subscribeKey("wcUri",e=>this.loadingTelegram=!e)))}disconnectedCallback(){this.unsubscribe.forEach(e=>e())}render(){return u`
      <wui-flex flexDirection="column" gap="2"> ${this.connectorListTemplate()} </wui-flex>
    `}connectorListTemplate(){return po.connectorList().map((e,o)=>e.kind==="connector"?this.renderConnector(e,o):this.renderWallet(e,o))}getConnectorNamespaces(e){return e.subtype==="walletConnect"?[]:e.subtype==="multiChain"?e.connector.connectors?.map(o=>o.chain)||[]:[e.connector.chain]}renderConnector(e,o){let i=e.connector,n=K.getConnectorImage(i)||this.connectorImages[i?.imageId??""],s=(this.connections.get(i.chain)??[]).some(O=>mo.isLowerCaseMatch(O.connectorId,i.id)),l,c;e.subtype==="walletConnect"?(l="qr code",c="accent"):e.subtype==="injected"||e.subtype==="announced"?(l=s?"connected":"installed",c=s?"info":"success"):(l=void 0,c=void 0);let g=x.hasAnyConnection(je.CONNECTOR_ID.WALLET_CONNECT),y=e.subtype==="walletConnect"||e.subtype==="external"?g:!1;return u`
      <w3m-list-wallet
        displayIndex=${o}
        imageSrc=${E(n)}
        .installed=${!0}
        name=${i.name??"Unknown"}
        .tagVariant=${c}
        tagLabel=${E(l)}
        data-testid=${`wallet-selector-${i.id.toLowerCase()}`}
        size="sm"
        @click=${()=>this.onClickConnector(e)}
        tabIdx=${E(this.tabIdx)}
        ?disabled=${y}
        rdnsId=${E(i.explorerWallet?.rdns||void 0)}
        walletRank=${E(i.explorerWallet?.order)}
        .namespaces=${this.getConnectorNamespaces(e)}
      >
      </w3m-list-wallet>
    `}onClickConnector(e){let o=b.state.data?.redirectView;if(e.subtype==="walletConnect"){z.setActiveConnector(e.connector),C.isMobile()?b.push("AllWallets"):b.push("ConnectingWalletConnect",{redirectView:o});return}if(e.subtype==="multiChain"){z.setActiveConnector(e.connector),b.push("ConnectingMultiChain",{redirectView:o});return}if(e.subtype==="injected"){z.setActiveConnector(e.connector),b.push("ConnectingExternal",{connector:e.connector,redirectView:o,wallet:e.connector.explorerWallet});return}if(e.subtype==="announced"){if(e.connector.id==="walletConnect"){C.isMobile()?b.push("AllWallets"):b.push("ConnectingWalletConnect",{redirectView:o});return}b.push("ConnectingExternal",{connector:e.connector,redirectView:o,wallet:e.connector.explorerWallet});return}b.push("ConnectingExternal",{connector:e.connector,redirectView:o})}renderWallet(e,o){let i=e.wallet,n=K.getWalletImage(i),s=x.hasAnyConnection(je.CONNECTOR_ID.WALLET_CONNECT),l=this.loadingTelegram,c=e.subtype==="recent"?"recent":void 0,g=e.subtype==="recent"?"info":void 0;return u`
      <w3m-list-wallet
        displayIndex=${o}
        imageSrc=${E(n)}
        name=${i.name??"Unknown"}
        @click=${()=>this.onClickWallet(e)}
        size="sm"
        data-testid=${`wallet-selector-${i.id}`}
        tabIdx=${E(this.tabIdx)}
        ?loading=${l}
        ?disabled=${s}
        rdnsId=${E(i.rdns||void 0)}
        walletRank=${E(i.order)}
        tagLabel=${E(c)}
        .tagVariant=${g}
      >
      </w3m-list-wallet>
    `}onClickWallet(e){let o=b.state.data?.redirectView,i=Q.state.activeChain;if(e.subtype==="featured"){z.selectWalletConnector(e.wallet);return}if(e.subtype==="recent"){if(this.loadingTelegram)return;z.selectWalletConnector(e.wallet);return}if(e.subtype==="custom"){if(this.loadingTelegram)return;b.push("ConnectingWalletConnect",{wallet:e.wallet,redirectView:o});return}if(this.loadingTelegram)return;let n=i?z.getConnector({id:e.wallet.id,namespace:i}):void 0;n?b.push("ConnectingExternal",{connector:n,redirectView:o}):b.push("ConnectingWalletConnect",{wallet:e.wallet,redirectView:o})}};ce.styles=xo;Ie([h({type:Number})],ce.prototype,"tabIdx",void 0);Ie([m()],ce.prototype,"explorerWallets",void 0);Ie([m()],ce.prototype,"connections",void 0);Ie([m()],ce.prototype,"connectorImages",void 0);Ie([m()],ce.prototype,"loadingTelegram",void 0);ce=Ie([f("w3m-connector-list")],ce);a();a();a();a();a();a();var Co=$`
  :host {
    flex: 1;
    height: 100%;
  }

  button {
    width: 100%;
    height: 100%;
    display: inline-flex;
    align-items: center;
    padding: ${({spacing:t})=>t[1]} ${({spacing:t})=>t[2]};
    column-gap: ${({spacing:t})=>t[1]};
    color: ${({tokens:t})=>t.theme.textSecondary};
    border-radius: ${({borderRadius:t})=>t[20]};
    background-color: transparent;
    transition: background-color ${({durations:t})=>t.lg}
      ${({easings:t})=>t["ease-out-power-2"]};
    will-change: background-color;
  }

  /* -- Hover & Active states ----------------------------------------------------------- */
  button[data-active='true'] {
    color: ${({tokens:t})=>t.theme.textPrimary};
    background-color: ${({tokens:t})=>t.theme.foregroundTertiary};
  }

  button:hover:enabled:not([data-active='true']),
  button:active:enabled:not([data-active='true']) {
    wui-text,
    wui-icon {
      color: ${({tokens:t})=>t.theme.textPrimary};
    }
  }
`;var qe=function(t,e,o,i){var n=arguments.length,r=n<3?e:i===null?i=Object.getOwnPropertyDescriptor(e,o):i,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")r=Reflect.decorate(t,e,o,i);else for(var l=t.length-1;l>=0;l--)(s=t[l])&&(r=(n<3?s(r):n>3?s(e,o,r):s(e,o))||r);return n>3&&r&&Object.defineProperty(e,o,r),r},ni={lg:"lg-regular",md:"md-regular",sm:"sm-regular"},si={lg:"md",md:"sm",sm:"sm"},ge=class extends w{constructor(){super(...arguments),this.icon="mobile",this.size="md",this.label="",this.active=!1}render(){return u`
      <button data-active=${this.active}>
        ${this.icon?u`<wui-icon size=${si[this.size]} name=${this.icon}></wui-icon>`:""}
        <wui-text variant=${ni[this.size]}> ${this.label} </wui-text>
      </button>
    `}};ge.styles=[k,q,Co];qe([h()],ge.prototype,"icon",void 0);qe([h()],ge.prototype,"size",void 0);qe([h()],ge.prototype,"label",void 0);qe([h({type:Boolean})],ge.prototype,"active",void 0);ge=qe([f("wui-tab-item")],ge);a();var $o=$`
  :host {
    display: inline-flex;
    align-items: center;
    background-color: ${({tokens:t})=>t.theme.foregroundSecondary};
    border-radius: ${({borderRadius:t})=>t[32]};
    padding: ${({spacing:t})=>t["01"]};
    box-sizing: border-box;
  }

  :host([data-size='sm']) {
    height: 26px;
  }

  :host([data-size='md']) {
    height: 36px;
  }
`;var Fe=function(t,e,o,i){var n=arguments.length,r=n<3?e:i===null?i=Object.getOwnPropertyDescriptor(e,o):i,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")r=Reflect.decorate(t,e,o,i);else for(var l=t.length-1;l>=0;l--)(s=t[l])&&(r=(n<3?s(r):n>3?s(e,o,r):s(e,o))||r);return n>3&&r&&Object.defineProperty(e,o,r),r},we=class extends w{constructor(){super(...arguments),this.tabs=[],this.onTabChange=()=>null,this.size="md",this.activeTab=0}render(){return this.dataset.size=this.size,this.tabs.map((e,o)=>{let i=o===this.activeTab;return u`
        <wui-tab-item
          @click=${()=>this.onTabClick(o)}
          icon=${e.icon}
          size=${this.size}
          label=${e.label}
          ?active=${i}
          data-active=${i}
          data-testid="tab-${e.label?.toLowerCase()}"
        ></wui-tab-item>
      `})}onTabClick(e){this.activeTab=e,this.onTabChange(e)}};we.styles=[k,q,$o];Fe([h({type:Array})],we.prototype,"tabs",void 0);Fe([h()],we.prototype,"onTabChange",void 0);Fe([h()],we.prototype,"size",void 0);Fe([m()],we.prototype,"activeTab",void 0);we=Fe([f("wui-tabs")],we);var Bt=function(t,e,o,i){var n=arguments.length,r=n<3?e:i===null?i=Object.getOwnPropertyDescriptor(e,o):i,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")r=Reflect.decorate(t,e,o,i);else for(var l=t.length-1;l>=0;l--)(s=t[l])&&(r=(n<3?s(r):n>3?s(e,o,r):s(e,o))||r);return n>3&&r&&Object.defineProperty(e,o,r),r},st=class extends w{constructor(){super(...arguments),this.platformTabs=[],this.unsubscribe=[],this.platforms=[],this.onSelectPlatfrom=void 0}disconnectCallback(){this.unsubscribe.forEach(e=>e())}render(){let e=this.generateTabs();return u`
      <wui-flex justifyContent="center" .padding=${["0","0","4","0"]}>
        <wui-tabs .tabs=${e} .onTabChange=${this.onTabChange.bind(this)}></wui-tabs>
      </wui-flex>
    `}generateTabs(){let e=this.platforms.map(o=>o==="browser"?{label:"Browser",icon:"extension",platform:"browser"}:o==="mobile"?{label:"Mobile",icon:"mobile",platform:"mobile"}:o==="qrcode"?{label:"Mobile",icon:"mobile",platform:"qrcode"}:o==="web"?{label:"Webapp",icon:"browser",platform:"web"}:o==="desktop"?{label:"Desktop",icon:"desktop",platform:"desktop"}:{label:"Browser",icon:"extension",platform:"unsupported"});return this.platformTabs=e.map(({platform:o})=>o),e}onTabChange(e){let o=this.platformTabs[e];o&&this.onSelectPlatfrom?.(o)}};Bt([h({type:Array})],st.prototype,"platforms",void 0);Bt([h()],st.prototype,"onSelectPlatfrom",void 0);st=Bt([f("w3m-connecting-header")],st);a();a();a();a();a();a();var vo=$`
  :host {
    display: block;
    width: 100px;
    height: 100px;
  }

  svg {
    width: 100px;
    height: 100px;
  }

  rect {
    fill: none;
    stroke: ${t=>t.colors.accent100};
    stroke-width: 3px;
    stroke-linecap: round;
    animation: dash 1s linear infinite;
  }

  @keyframes dash {
    to {
      stroke-dashoffset: 0px;
    }
  }
`;var Eo=function(t,e,o,i){var n=arguments.length,r=n<3?e:i===null?i=Object.getOwnPropertyDescriptor(e,o):i,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")r=Reflect.decorate(t,e,o,i);else for(var l=t.length-1;l>=0;l--)(s=t[l])&&(r=(n<3?s(r):n>3?s(e,o,r):s(e,o))||r);return n>3&&r&&Object.defineProperty(e,o,r),r},lt=class extends w{constructor(){super(...arguments),this.radius=36}render(){return this.svgLoaderTemplate()}svgLoaderTemplate(){let e=this.radius>50?50:this.radius,i=36-e,n=116+i,r=245+i,s=360+i*1.75;return u`
      <svg viewBox="0 0 110 110" width="110" height="110">
        <rect
          x="2"
          y="2"
          width="106"
          height="106"
          rx=${e}
          stroke-dasharray="${n} ${r}"
          stroke-dashoffset=${s}
        />
      </svg>
    `}};lt.styles=[k,vo];Eo([h({type:Number})],lt.prototype,"radius",void 0);lt=Eo([f("wui-loading-thumbnail")],lt);a();a();a();a();var Ro=$`
  wui-flex {
    width: 100%;
    height: 52px;
    box-sizing: border-box;
    background-color: ${({tokens:t})=>t.theme.foregroundPrimary};
    border-radius: ${({borderRadius:t})=>t[5]};
    padding-left: ${({spacing:t})=>t[3]};
    padding-right: ${({spacing:t})=>t[3]};
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${({spacing:t})=>t[6]};
  }

  wui-text {
    color: ${({tokens:t})=>t.theme.textSecondary};
  }

  wui-icon {
    width: 12px;
    height: 12px;
  }
`;var at=function(t,e,o,i){var n=arguments.length,r=n<3?e:i===null?i=Object.getOwnPropertyDescriptor(e,o):i,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")r=Reflect.decorate(t,e,o,i);else for(var l=t.length-1;l>=0;l--)(s=t[l])&&(r=(n<3?s(r):n>3?s(e,o,r):s(e,o))||r);return n>3&&r&&Object.defineProperty(e,o,r),r},We=class extends w{constructor(){super(...arguments),this.disabled=!1,this.label="",this.buttonLabel=""}render(){return u`
      <wui-flex justifyContent="space-between" alignItems="center">
        <wui-text variant="lg-regular" color="inherit">${this.label}</wui-text>
        <wui-button variant="accent-secondary" size="sm">
          ${this.buttonLabel}
          <wui-icon name="chevronRight" color="inherit" size="inherit" slot="iconRight"></wui-icon>
        </wui-button>
      </wui-flex>
    `}};We.styles=[k,q,Ro];at([h({type:Boolean})],We.prototype,"disabled",void 0);at([h()],We.prototype,"label",void 0);at([h()],We.prototype,"buttonLabel",void 0);We=at([f("wui-cta-button")],We);a();var So=$`
  :host {
    display: block;
    padding: 0 ${({spacing:t})=>t[5]} ${({spacing:t})=>t[5]};
  }
`;var _o=function(t,e,o,i){var n=arguments.length,r=n<3?e:i===null?i=Object.getOwnPropertyDescriptor(e,o):i,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")r=Reflect.decorate(t,e,o,i);else for(var l=t.length-1;l>=0;l--)(s=t[l])&&(r=(n<3?s(r):n>3?s(e,o,r):s(e,o))||r);return n>3&&r&&Object.defineProperty(e,o,r),r},ct=class extends w{constructor(){super(...arguments),this.wallet=void 0}render(){if(!this.wallet)return this.style.display="none",null;let{name:e,app_store:o,play_store:i,chrome_store:n,homepage:r}=this.wallet,s=C.isMobile(),l=C.isIos(),c=C.isAndroid(),g=[o,i,r,n].filter(Boolean).length>1,y=ee.getTruncateString({string:e,charsStart:12,charsEnd:0,truncate:"end"});return g&&!s?u`
        <wui-cta-button
          label=${`Don't have ${y}?`}
          buttonLabel="Get"
          @click=${()=>b.push("Downloads",{wallet:this.wallet})}
        ></wui-cta-button>
      `:!g&&r?u`
        <wui-cta-button
          label=${`Don't have ${y}?`}
          buttonLabel="Get"
          @click=${this.onHomePage.bind(this)}
        ></wui-cta-button>
      `:o&&l?u`
        <wui-cta-button
          label=${`Don't have ${y}?`}
          buttonLabel="Get"
          @click=${this.onAppStore.bind(this)}
        ></wui-cta-button>
      `:i&&c?u`
        <wui-cta-button
          label=${`Don't have ${y}?`}
          buttonLabel="Get"
          @click=${this.onPlayStore.bind(this)}
        ></wui-cta-button>
      `:(this.style.display="none",null)}onAppStore(){this.wallet?.app_store&&C.openHref(this.wallet.app_store,"_blank")}onPlayStore(){this.wallet?.play_store&&C.openHref(this.wallet.play_store,"_blank")}onHomePage(){this.wallet?.homepage&&C.openHref(this.wallet.homepage,"_blank")}};ct.styles=[So];_o([h({type:Object})],ct.prototype,"wallet",void 0);ct=_o([f("w3m-mobile-download-links")],ct);a();var Ao=$`
  @keyframes shake {
    0% {
      transform: translateX(0);
    }
    25% {
      transform: translateX(3px);
    }
    50% {
      transform: translateX(-3px);
    }
    75% {
      transform: translateX(3px);
    }
    100% {
      transform: translateX(0);
    }
  }

  wui-flex:first-child:not(:only-child) {
    position: relative;
  }

  wui-wallet-image {
    width: 56px;
    height: 56px;
  }

  wui-loading-thumbnail {
    position: absolute;
  }

  wui-icon-box {
    position: absolute;
    right: calc(${({spacing:t})=>t[1]} * -1);
    bottom: calc(${({spacing:t})=>t[1]} * -1);
    opacity: 0;
    transform: scale(0.5);
    transition-property: opacity, transform;
    transition-duration: ${({durations:t})=>t.lg};
    transition-timing-function: ${({easings:t})=>t["ease-out-power-2"]};
    will-change: opacity, transform;
  }

  wui-text[align='center'] {
    width: 100%;
    padding: 0px ${({spacing:t})=>t[4]};
  }

  [data-error='true'] wui-icon-box {
    opacity: 1;
    transform: scale(1);
  }

  [data-error='true'] > wui-flex:first-child {
    animation: shake 250ms ${({easings:t})=>t["ease-out-power-2"]} both;
  }

  [data-retry='false'] wui-link {
    display: none;
  }

  [data-retry='true'] wui-link {
    display: block;
    opacity: 1;
  }

  w3m-mobile-download-links {
    padding: 0px;
    width: 100%;
  }
`;var te=function(t,e,o,i){var n=arguments.length,r=n<3?e:i===null?i=Object.getOwnPropertyDescriptor(e,o):i,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")r=Reflect.decorate(t,e,o,i);else for(var l=t.length-1;l>=0;l--)(s=t[l])&&(r=(n<3?s(r):n>3?s(e,o,r):s(e,o))||r);return n>3&&r&&Object.defineProperty(e,o,r),r},L=class extends w{constructor(){super(),this.wallet=b.state.data?.wallet,this.connector=b.state.data?.connector,this.timeout=void 0,this.secondaryBtnIcon="refresh",this.onConnect=void 0,this.onRender=void 0,this.onAutoConnect=void 0,this.isWalletConnect=!0,this.unsubscribe=[],this.imageSrc=K.getConnectorImage(this.connector)??K.getWalletImage(this.wallet),this.name=this.wallet?.name??this.connector?.name??"Wallet",this.isRetrying=!1,this.uri=x.state.wcUri,this.error=x.state.wcError,this.ready=!1,this.showRetry=!1,this.label=void 0,this.secondaryBtnLabel="Try again",this.secondaryLabel="Accept connection request in the wallet",this.isLoading=!1,this.isMobile=!1,this.onRetry=void 0,this.unsubscribe.push(x.subscribeKey("wcUri",e=>{this.uri=e,this.isRetrying&&this.onRetry&&(this.isRetrying=!1,this.onConnect?.())}),x.subscribeKey("wcError",e=>this.error=e)),(C.isTelegram()||C.isSafari())&&C.isIos()&&x.state.wcUri&&this.onConnect?.()}firstUpdated(){this.onAutoConnect?.(),this.showRetry=!this.onAutoConnect}disconnectedCallback(){this.unsubscribe.forEach(e=>e()),x.setWcError(!1),clearTimeout(this.timeout)}render(){this.onRender?.(),this.onShowRetry();let e=this.error?"Connection can be declined if a previous request is still active":this.secondaryLabel,o="";return this.label?o=this.label:(o=`Continue in ${this.name}`,this.error&&(o="Connection declined")),u`
      <wui-flex
        data-error=${E(this.error)}
        data-retry=${this.showRetry}
        flexDirection="column"
        alignItems="center"
        .padding=${["10","5","5","5"]}
        gap="6"
      >
        <wui-flex gap="2" justifyContent="center" alignItems="center">
          <wui-wallet-image size="lg" imageSrc=${E(this.imageSrc)}></wui-wallet-image>

          ${this.error?null:this.loaderTemplate()}

          <wui-icon-box
            color="error"
            icon="close"
            size="sm"
            border
            borderColor="wui-color-bg-125"
          ></wui-icon-box>
        </wui-flex>

        <wui-flex flexDirection="column" alignItems="center" gap="6"> <wui-flex
          flexDirection="column"
          alignItems="center"
          gap="2"
          .padding=${["2","0","0","0"]}
        >
          <wui-text align="center" variant="lg-medium" color=${this.error?"error":"primary"}>
            ${o}
          </wui-text>
          <wui-text align="center" variant="lg-regular" color="secondary">${e}</wui-text>
        </wui-flex>

        ${this.secondaryBtnLabel?u`
                <wui-button
                  variant="neutral-secondary"
                  size="md"
                  ?disabled=${this.isRetrying||this.isLoading}
                  @click=${this.onTryAgain.bind(this)}
                  data-testid="w3m-connecting-widget-secondary-button"
                >
                  <wui-icon
                    color="inherit"
                    slot="iconLeft"
                    name=${this.secondaryBtnIcon}
                  ></wui-icon>
                  ${this.secondaryBtnLabel}
                </wui-button>
              `:null}
      </wui-flex>

      ${this.isWalletConnect?u`
              <wui-flex .padding=${["0","5","5","5"]} justifyContent="center">
                <wui-link
                  @click=${this.onCopyUri}
                  variant="secondary"
                  icon="copy"
                  data-testid="wui-link-copy"
                >
                  Copy link
                </wui-link>
              </wui-flex>
            `:null}

      <w3m-mobile-download-links .wallet=${this.wallet}></w3m-mobile-download-links></wui-flex>
      </wui-flex>
    `}onShowRetry(){this.error&&!this.showRetry&&(this.showRetry=!0,this.shadowRoot?.querySelector("wui-button")?.animate([{opacity:0},{opacity:1}],{fill:"forwards",easing:"ease"}))}onTryAgain(){x.setWcError(!1),this.onRetry?(this.isRetrying=!0,this.onRetry?.()):this.onConnect?.()}loaderTemplate(){let e=_e.state.themeVariables["--w3m-border-radius-master"],o=e?parseInt(e.replace("px",""),10):4;return u`<wui-loading-thumbnail radius=${o*9}></wui-loading-thumbnail>`}onCopyUri(){try{this.uri&&(C.copyToClopboard(this.uri),ae.showSuccess("Link copied"))}catch{ae.showError("Failed to copy")}}};L.styles=Ao;te([m()],L.prototype,"isRetrying",void 0);te([m()],L.prototype,"uri",void 0);te([m()],L.prototype,"error",void 0);te([m()],L.prototype,"ready",void 0);te([m()],L.prototype,"showRetry",void 0);te([m()],L.prototype,"label",void 0);te([m()],L.prototype,"secondaryBtnLabel",void 0);te([m()],L.prototype,"secondaryLabel",void 0);te([m()],L.prototype,"isLoading",void 0);te([h({type:Boolean})],L.prototype,"isMobile",void 0);te([h()],L.prototype,"onRetry",void 0);var li=function(t,e,o,i){var n=arguments.length,r=n<3?e:i===null?i=Object.getOwnPropertyDescriptor(e,o):i,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")r=Reflect.decorate(t,e,o,i);else for(var l=t.length-1;l>=0;l--)(s=t[l])&&(r=(n<3?s(r):n>3?s(e,o,r):s(e,o))||r);return n>3&&r&&Object.defineProperty(e,o,r),r},To=class extends L{constructor(){if(super(),!this.wallet)throw new Error("w3m-connecting-wc-browser: No wallet provided");this.onConnect=this.onConnectProxy.bind(this),this.onAutoConnect=this.onConnectProxy.bind(this),P.sendEvent({type:"track",event:"SELECT_WALLET",properties:{name:this.wallet.name,platform:"browser",displayIndex:this.wallet?.display_index,walletRank:this.wallet.order,view:b.state.view}})}async onConnectProxy(){try{this.error=!1;let{connectors:e}=z.state,o=e.find(i=>i.type==="ANNOUNCED"&&i.info?.rdns===this.wallet?.rdns||i.type==="INJECTED"||i.name===this.wallet?.name);if(o)await x.connectExternal(o,o.chain);else throw new Error("w3m-connecting-wc-browser: No connector found");it.close()}catch(e){e instanceof rt&&e.originalName===tt.PROVIDER_RPC_ERROR_NAME.USER_REJECTED_REQUEST?P.sendEvent({type:"track",event:"USER_REJECTED",properties:{message:e.message}}):P.sendEvent({type:"track",event:"CONNECT_ERROR",properties:{message:e?.message??"Unknown"}}),this.error=!0}}};To=li([f("w3m-connecting-wc-browser")],To);a();var ai=function(t,e,o,i){var n=arguments.length,r=n<3?e:i===null?i=Object.getOwnPropertyDescriptor(e,o):i,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")r=Reflect.decorate(t,e,o,i);else for(var l=t.length-1;l>=0;l--)(s=t[l])&&(r=(n<3?s(r):n>3?s(e,o,r):s(e,o))||r);return n>3&&r&&Object.defineProperty(e,o,r),r},Io=class extends L{constructor(){if(super(),!this.wallet)throw new Error("w3m-connecting-wc-desktop: No wallet provided");this.onConnect=this.onConnectProxy.bind(this),this.onRender=this.onRenderProxy.bind(this),P.sendEvent({type:"track",event:"SELECT_WALLET",properties:{name:this.wallet.name,platform:"desktop",displayIndex:this.wallet?.display_index,walletRank:this.wallet.order,view:b.state.view}})}onRenderProxy(){!this.ready&&this.uri&&(this.ready=!0,this.onConnect?.())}onConnectProxy(){if(this.wallet?.desktop_link&&this.uri)try{this.error=!1;let{desktop_link:e,name:o}=this.wallet,{redirect:i,href:n}=C.formatNativeUrl(e,this.uri);x.setWcLinking({name:o,href:n}),x.setRecentWallet(this.wallet),C.openHref(i,"_blank")}catch{this.error=!0}}};Io=ai([f("w3m-connecting-wc-desktop")],Io);a();var Le=function(t,e,o,i){var n=arguments.length,r=n<3?e:i===null?i=Object.getOwnPropertyDescriptor(e,o):i,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")r=Reflect.decorate(t,e,o,i);else for(var l=t.length-1;l>=0;l--)(s=t[l])&&(r=(n<3?s(r):n>3?s(e,o,r):s(e,o))||r);return n>3&&r&&Object.defineProperty(e,o,r),r},be=class extends L{constructor(){if(super(),this.btnLabelTimeout=void 0,this.redirectDeeplink=void 0,this.redirectUniversalLink=void 0,this.target=void 0,this.preferUniversalLinks=N.state.experimental_preferUniversalLinks,this.isLoading=!0,this.onConnect=()=>{ho.onConnectMobile(this.wallet)},!this.wallet)throw new Error("w3m-connecting-wc-mobile: No wallet provided");this.secondaryBtnLabel="Open",this.secondaryLabel=ot.CONNECT_LABELS.MOBILE,this.secondaryBtnIcon="externalLink",this.onHandleURI(),this.unsubscribe.push(x.subscribeKey("wcUri",()=>{this.onHandleURI()})),P.sendEvent({type:"track",event:"SELECT_WALLET",properties:{name:this.wallet.name,platform:"mobile",displayIndex:this.wallet?.display_index,walletRank:this.wallet.order,view:b.state.view}})}disconnectedCallback(){super.disconnectedCallback(),clearTimeout(this.btnLabelTimeout)}onHandleURI(){this.isLoading=!this.uri,!this.ready&&this.uri&&(this.ready=!0,this.onConnect?.())}onTryAgain(){x.setWcError(!1),this.onConnect?.()}};Le([m()],be.prototype,"redirectDeeplink",void 0);Le([m()],be.prototype,"redirectUniversalLink",void 0);Le([m()],be.prototype,"target",void 0);Le([m()],be.prototype,"preferUniversalLinks",void 0);Le([m()],be.prototype,"isLoading",void 0);be=Le([f("w3m-connecting-wc-mobile")],be);a();a();a();a();var Pr=ri(Wr(),1);var rn=.1,Lr=2.5,se=7;function ro(t,e,o){return t===e?!1:(t-e<0?e-t:t-e)<=o+rn}function nn(t,e){let o=Array.prototype.slice.call(Pr.default.create(t,{errorCorrectionLevel:e}).modules.data,0),i=Math.sqrt(o.length);return o.reduce((n,r,s)=>(s%i===0?n.push([r]):n[n.length-1].push(r))&&n,[])}var Br={generate({uri:t,size:e,logoSize:o,padding:i=8,dotColor:n="var(--apkt-colors-black)"}){let s=[],l=nn(t,"Q"),c=(e-2*i)/l.length,g=[{x:0,y:0},{x:1,y:0},{x:0,y:1}];g.forEach(({x:S,y:v})=>{let U=(l.length-se)*c*S+i,_=(l.length-se)*c*v+i,j=.45;for(let B=0;B<g.length;B+=1){let D=c*(se-B*2);s.push(Ae`
            <rect
              fill=${B===2?"var(--apkt-colors-black)":"var(--apkt-colors-white)"}
              width=${B===0?D-10:D}
              rx= ${B===0?(D-10)*j:D*j}
              ry= ${B===0?(D-10)*j:D*j}
              stroke=${n}
              stroke-width=${B===0?10:0}
              height=${B===0?D-10:D}
              x= ${B===0?_+c*B+10/2:_+c*B}
              y= ${B===0?U+c*B+10/2:U+c*B}
            />
          `)}});let y=Math.floor((o+25)/c),O=l.length/2-y/2,T=l.length/2+y/2-1,G=[];l.forEach((S,v)=>{S.forEach((U,_)=>{if(l[v][_]&&!(v<se&&_<se||v>l.length-(se+1)&&_<se||v<se&&_>l.length-(se+1))&&!(v>O&&v<T&&_>O&&_<T)){let j=v*c+c/2+i,B=_*c+c/2+i;G.push([j,B])}})});let H={};return G.forEach(([S,v])=>{H[S]?H[S]?.push(v):H[S]=[v]}),Object.entries(H).map(([S,v])=>{let U=v.filter(_=>v.every(j=>!ro(_,j,c)));return[Number(S),U]}).forEach(([S,v])=>{v.forEach(U=>{s.push(Ae`<circle cx=${S} cy=${U} fill=${n} r=${c/Lr} />`)})}),Object.entries(H).filter(([S,v])=>v.length>1).map(([S,v])=>{let U=v.filter(_=>v.some(j=>ro(_,j,c)));return[Number(S),U]}).map(([S,v])=>{v.sort((_,j)=>_<j?-1:1);let U=[];for(let _ of v){let j=U.find(B=>B.some(D=>ro(_,D,c)));j?j.push(_):U.push([_])}return[S,U.map(_=>[_[0],_[_.length-1]])]}).forEach(([S,v])=>{v.forEach(([U,_])=>{s.push(Ae`
              <line
                x1=${S}
                x2=${S}
                y1=${U}
                y2=${_}
                stroke=${n}
                stroke-width=${c/(Lr/2)}
                stroke-linecap="round"
              />
            `)})}),s}};a();var kr=$`
  :host {
    position: relative;
    user-select: none;
    display: block;
    overflow: hidden;
    aspect-ratio: 1 / 1;
    width: 100%;
    height: 100%;
    background-color: ${({colors:t})=>t.white};
    border: 1px solid ${({tokens:t})=>t.theme.borderPrimary};
  }

  :host {
    border-radius: ${({borderRadius:t})=>t[4]};
    display: flex;
    align-items: center;
    justify-content: center;
  }

  :host([data-clear='true']) > wui-icon {
    display: none;
  }

  svg:first-child,
  wui-image,
  wui-icon {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translateY(-50%) translateX(-50%);
    background-color: ${({tokens:t})=>t.theme.backgroundPrimary};
    box-shadow: inset 0 0 0 4px ${({tokens:t})=>t.theme.backgroundPrimary};
    border-radius: ${({borderRadius:t})=>t[6]};
  }

  wui-image {
    width: 25%;
    height: 25%;
    border-radius: ${({borderRadius:t})=>t[2]};
  }

  wui-icon {
    width: 100%;
    height: 100%;
    color: #3396ff !important;
    transform: translateY(-50%) translateX(-50%) scale(0.25);
  }

  wui-icon > svg {
    width: inherit;
    height: inherit;
  }
`;var fe=function(t,e,o,i){var n=arguments.length,r=n<3?e:i===null?i=Object.getOwnPropertyDescriptor(e,o):i,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")r=Reflect.decorate(t,e,o,i);else for(var l=t.length-1;l>=0;l--)(s=t[l])&&(r=(n<3?s(r):n>3?s(e,o,r):s(e,o))||r);return n>3&&r&&Object.defineProperty(e,o,r),r},oe=class extends w{constructor(){super(...arguments),this.uri="",this.size=500,this.theme="dark",this.imageSrc=void 0,this.alt=void 0,this.arenaClear=void 0,this.farcaster=void 0}render(){return this.dataset.theme=this.theme,this.dataset.clear=String(this.arenaClear),u`<wui-flex
      alignItems="center"
      justifyContent="center"
      class="wui-qr-code"
      direction="column"
      gap="4"
      width="100%"
      style="height: 100%"
    >
      ${this.templateVisual()} ${this.templateSvg()}
    </wui-flex>`}templateSvg(){return Ae`
      <svg viewBox="0 0 ${this.size} ${this.size}" width="100%" height="100%">
        ${Br.generate({uri:this.uri,size:this.size,logoSize:this.arenaClear?0:this.size/4})}
      </svg>
    `}templateVisual(){return this.imageSrc?u`<wui-image src=${this.imageSrc} alt=${this.alt??"logo"}></wui-image>`:this.farcaster?u`<wui-icon
        class="farcaster"
        size="inherit"
        color="inherit"
        name="farcaster"
      ></wui-icon>`:u`<wui-icon size="inherit" color="inherit" name="walletConnect"></wui-icon>`}};oe.styles=[k,kr];fe([h()],oe.prototype,"uri",void 0);fe([h({type:Number})],oe.prototype,"size",void 0);fe([h()],oe.prototype,"theme",void 0);fe([h()],oe.prototype,"imageSrc",void 0);fe([h()],oe.prototype,"alt",void 0);fe([h({type:Boolean})],oe.prototype,"arenaClear",void 0);fe([h({type:Boolean})],oe.prototype,"farcaster",void 0);oe=fe([f("wui-qr-code")],oe);a();var Nr=$`
  wui-shimmer {
    width: 100%;
    aspect-ratio: 1 / 1;
    border-radius: ${({borderRadius:t})=>t[4]};
  }

  wui-qr-code {
    opacity: 0;
    animation-duration: ${({durations:t})=>t.xl};
    animation-timing-function: ${({easings:t})=>t["ease-out-power-2"]};
    animation-name: fade-in;
    animation-fill-mode: forwards;
  }

  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
`;var Or=function(t,e,o,i){var n=arguments.length,r=n<3?e:i===null?i=Object.getOwnPropertyDescriptor(e,o):i,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")r=Reflect.decorate(t,e,o,i);else for(var l=t.length-1;l>=0;l--)(s=t[l])&&(r=(n<3?s(r):n>3?s(e,o,r):s(e,o))||r);return n>3&&r&&Object.defineProperty(e,o,r),r},Ct=class extends L{constructor(){super(),this.basic=!1}firstUpdated(){this.basic||P.sendEvent({type:"track",event:"SELECT_WALLET",properties:{name:this.wallet?.name??"WalletConnect",platform:"qrcode",displayIndex:this.wallet?.display_index,walletRank:this.wallet?.order,view:b.state.view}})}disconnectedCallback(){super.disconnectedCallback(),this.unsubscribe?.forEach(e=>e())}render(){return this.onRenderProxy(),u`
      <wui-flex
        flexDirection="column"
        alignItems="center"
        .padding=${["0","5","5","5"]}
        gap="5"
      >
        <wui-shimmer width="100%"> ${this.qrCodeTemplate()} </wui-shimmer>
        <wui-text variant="lg-medium" color="primary"> Scan this QR Code with your phone </wui-text>
        ${this.copyTemplate()}
      </wui-flex>
      <w3m-mobile-download-links .wallet=${this.wallet}></w3m-mobile-download-links>
    `}onRenderProxy(){!this.ready&&this.uri&&(this.ready=!0)}qrCodeTemplate(){if(!this.uri||!this.ready)return null;let e=this.wallet?this.wallet.name:void 0;x.setWcLinking(void 0),x.setRecentWallet(this.wallet);let o=_e.state.themeVariables["--apkt-qr-color"]??_e.state.themeVariables["--w3m-qr-color"];return u` <wui-qr-code
      theme=${_e.state.themeMode}
      uri=${this.uri}
      imageSrc=${E(K.getWalletImage(this.wallet))}
      color=${E(o)}
      alt=${E(e)}
      data-testid="wui-qr-code"
    ></wui-qr-code>`}copyTemplate(){let e=!this.uri||!this.ready;return u`<wui-button
      .disabled=${e}
      @click=${this.onCopyUri}
      variant="neutral-secondary"
      size="sm"
      data-testid="copy-wc2-uri"
    >
      Copy link
      <wui-icon size="sm" color="inherit" name="copy" slot="iconRight"></wui-icon>
    </wui-button>`}};Ct.styles=Nr;Or([h({type:Boolean})],Ct.prototype,"basic",void 0);Ct=Or([f("w3m-connecting-wc-qrcode")],Ct);a();var sn=function(t,e,o,i){var n=arguments.length,r=n<3?e:i===null?i=Object.getOwnPropertyDescriptor(e,o):i,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")r=Reflect.decorate(t,e,o,i);else for(var l=t.length-1;l>=0;l--)(s=t[l])&&(r=(n<3?s(r):n>3?s(e,o,r):s(e,o))||r);return n>3&&r&&Object.defineProperty(e,o,r),r},Dr=class extends w{constructor(){if(super(),this.wallet=b.state.data?.wallet,!this.wallet)throw new Error("w3m-connecting-wc-unsupported: No wallet provided");P.sendEvent({type:"track",event:"SELECT_WALLET",properties:{name:this.wallet.name,platform:"browser",displayIndex:this.wallet?.display_index,walletRank:this.wallet?.order,view:b.state.view}})}render(){return u`
      <wui-flex
        flexDirection="column"
        alignItems="center"
        .padding=${["10","5","5","5"]}
        gap="5"
      >
        <wui-wallet-image
          size="lg"
          imageSrc=${E(K.getWalletImage(this.wallet))}
        ></wui-wallet-image>

        <wui-text variant="md-regular" color="primary">Not Detected</wui-text>
      </wui-flex>

      <w3m-mobile-download-links .wallet=${this.wallet}></w3m-mobile-download-links>
    `}};Dr=sn([f("w3m-connecting-wc-unsupported")],Dr);a();var Mr=function(t,e,o,i){var n=arguments.length,r=n<3?e:i===null?i=Object.getOwnPropertyDescriptor(e,o):i,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")r=Reflect.decorate(t,e,o,i);else for(var l=t.length-1;l>=0;l--)(s=t[l])&&(r=(n<3?s(r):n>3?s(e,o,r):s(e,o))||r);return n>3&&r&&Object.defineProperty(e,o,r),r},io=class extends L{constructor(){if(super(),this.isLoading=!0,!this.wallet)throw new Error("w3m-connecting-wc-web: No wallet provided");this.onConnect=this.onConnectProxy.bind(this),this.secondaryBtnLabel="Open",this.secondaryLabel=ot.CONNECT_LABELS.MOBILE,this.secondaryBtnIcon="externalLink",this.updateLoadingState(),this.unsubscribe.push(x.subscribeKey("wcUri",()=>{this.updateLoadingState()})),P.sendEvent({type:"track",event:"SELECT_WALLET",properties:{name:this.wallet.name,platform:"web",displayIndex:this.wallet?.display_index,walletRank:this.wallet?.order,view:b.state.view}})}updateLoadingState(){this.isLoading=!this.uri}onConnectProxy(){if(this.wallet?.webapp_link&&this.uri)try{this.error=!1;let{webapp_link:e,name:o}=this.wallet,{redirect:i,href:n}=C.formatUniversalUrl(e,this.uri);x.setWcLinking({name:o,href:n}),x.setRecentWallet(this.wallet),C.openHref(i,"_blank")}catch{this.error=!0}}};Mr([m()],io.prototype,"isLoading",void 0);io=Mr([f("w3m-connecting-wc-web")],io);a();var Ur=$`
  :host([data-mobile-fullscreen='true']) {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  :host([data-mobile-fullscreen='true']) wui-ux-by-reown {
    margin-top: auto;
  }
`;var ve=function(t,e,o,i){var n=arguments.length,r=n<3?e:i===null?i=Object.getOwnPropertyDescriptor(e,o):i,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")r=Reflect.decorate(t,e,o,i);else for(var l=t.length-1;l>=0;l--)(s=t[l])&&(r=(n<3?s(r):n>3?s(e,o,r):s(e,o))||r);return n>3&&r&&Object.defineProperty(e,o,r),r},le=class extends w{constructor(){super(),this.wallet=b.state.data?.wallet,this.unsubscribe=[],this.platform=void 0,this.platforms=[],this.isSiwxEnabled=!!N.state.siwx,this.remoteFeatures=N.state.remoteFeatures,this.displayBranding=!0,this.basic=!1,this.determinePlatforms(),this.initializeConnection(),this.unsubscribe.push(N.subscribeKey("remoteFeatures",e=>this.remoteFeatures=e))}disconnectedCallback(){this.unsubscribe.forEach(e=>e())}render(){return N.state.enableMobileFullScreen&&this.setAttribute("data-mobile-fullscreen","true"),u`
      ${this.headerTemplate()}
      <div class="platform-container">${this.platformTemplate()}</div>
      ${this.reownBrandingTemplate()}
    `}reownBrandingTemplate(){return!this.remoteFeatures?.reownBranding||!this.displayBranding?null:u`<wui-ux-by-reown></wui-ux-by-reown>`}async initializeConnection(e=!1){if(!(this.platform==="browser"||N.state.manualWCControl&&!e))try{let{wcPairingExpiry:o,status:i}=x.state,{redirectView:n}=b.state.data??{};if(e||N.state.enableEmbedded||C.isPairingExpired(o)||i==="connecting"){let r=x.getConnections(Q.state.activeChain),s=this.remoteFeatures?.multiWallet,l=r.length>0;await x.connectWalletConnect({cache:"never"}),this.isSiwxEnabled||(l&&s?(b.replace("ProfileWallets"),ae.showSuccess("New Wallet Added")):n?b.replace(n):it.close())}}catch(o){if(o instanceof Error&&o.message.includes("An error occurred when attempting to switch chain")&&!N.state.enableNetworkSwitch&&Q.state.activeChain){Q.setActiveCaipNetwork(go.getUnsupportedNetwork(`${Q.state.activeChain}:${Q.state.activeCaipNetwork?.id}`)),Q.showUnsupportedChainUI();return}o instanceof rt&&o.originalName===tt.PROVIDER_RPC_ERROR_NAME.USER_REJECTED_REQUEST?P.sendEvent({type:"track",event:"USER_REJECTED",properties:{message:o.message}}):P.sendEvent({type:"track",event:"CONNECT_ERROR",properties:{message:o?.message??"Unknown"}}),x.setWcError(!0),ae.showError(o.message??"Connection error"),x.resetWcConnection(),b.goBack()}}determinePlatforms(){if(!this.wallet){this.platforms.push("qrcode"),this.platform="qrcode";return}if(this.platform)return;let{mobile_link:e,desktop_link:o,webapp_link:i,injected:n,rdns:r}=this.wallet,s=n?.map(({injected_id:S})=>S).filter(Boolean),l=[...r?[r]:s??[]],c=N.state.isUniversalProvider?!1:l.length,g=e,y=i,O=x.checkInstalled(l),T=c&&O,G=o&&!C.isMobile();T&&!Q.state.noAdapters&&this.platforms.push("browser"),g&&this.platforms.push(C.isMobile()?"mobile":"qrcode"),y&&this.platforms.push("web"),G&&this.platforms.push("desktop");let H=uo.isCustomDeeplinkWallet(this.wallet.id,Q.state.activeChain);!T&&c&&!Q.state.noAdapters&&!H&&this.platforms.push("unsupported"),this.platform=this.platforms[0]}platformTemplate(){switch(this.platform){case"browser":return u`<w3m-connecting-wc-browser></w3m-connecting-wc-browser>`;case"web":return u`<w3m-connecting-wc-web></w3m-connecting-wc-web>`;case"desktop":return u`
          <w3m-connecting-wc-desktop .onRetry=${()=>this.initializeConnection(!0)}>
          </w3m-connecting-wc-desktop>
        `;case"mobile":return u`
          <w3m-connecting-wc-mobile isMobile .onRetry=${()=>this.initializeConnection(!0)}>
          </w3m-connecting-wc-mobile>
        `;case"qrcode":return u`<w3m-connecting-wc-qrcode ?basic=${this.basic}></w3m-connecting-wc-qrcode>`;default:return u`<w3m-connecting-wc-unsupported></w3m-connecting-wc-unsupported>`}}headerTemplate(){return this.platforms.length>1?u`
      <w3m-connecting-header
        .platforms=${this.platforms}
        .onSelectPlatfrom=${this.onSelectPlatform.bind(this)}
      >
      </w3m-connecting-header>
    `:null}async onSelectPlatform(e){let o=this.shadowRoot?.querySelector("div");o&&(await o.animate([{opacity:1},{opacity:0}],{duration:200,fill:"forwards",easing:"ease"}).finished,this.platform=e,o.animate([{opacity:0},{opacity:1}],{duration:200,fill:"forwards",easing:"ease"}))}};le.styles=Ur;ve([m()],le.prototype,"platform",void 0);ve([m()],le.prototype,"platforms",void 0);ve([m()],le.prototype,"isSiwxEnabled",void 0);ve([m()],le.prototype,"remoteFeatures",void 0);ve([h({type:Boolean})],le.prototype,"displayBranding",void 0);ve([h({type:Boolean})],le.prototype,"basic",void 0);le=ve([f("w3m-connecting-wc-view")],le);var no=function(t,e,o,i){var n=arguments.length,r=n<3?e:i===null?i=Object.getOwnPropertyDescriptor(e,o):i,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")r=Reflect.decorate(t,e,o,i);else for(var l=t.length-1;l>=0;l--)(s=t[l])&&(r=(n<3?s(r):n>3?s(e,o,r):s(e,o))||r);return n>3&&r&&Object.defineProperty(e,o,r),r},$t=class extends w{constructor(){super(),this.unsubscribe=[],this.isMobile=C.isMobile(),this.remoteFeatures=N.state.remoteFeatures,this.unsubscribe.push(N.subscribeKey("remoteFeatures",e=>this.remoteFeatures=e))}disconnectedCallback(){this.unsubscribe.forEach(e=>e())}render(){if(this.isMobile){let{featured:e,recommended:o}=I.state,{customWallets:i}=N.state,n=co.getRecentWallets(),r=e.length||o.length||i?.length||n.length;return u`<wui-flex flexDirection="column" gap="2" .margin=${["1","3","3","3"]}>
        ${r?u`<w3m-connector-list></w3m-connector-list>`:null}
        <w3m-all-wallets-widget></w3m-all-wallets-widget>
      </wui-flex>`}return u`<wui-flex flexDirection="column" .padding=${["0","0","4","0"]}>
        <w3m-connecting-wc-view ?basic=${!0} .displayBranding=${!1}></w3m-connecting-wc-view>
        <wui-flex flexDirection="column" .padding=${["0","3","0","3"]}>
          <w3m-all-wallets-widget></w3m-all-wallets-widget>
        </wui-flex>
      </wui-flex>
      ${this.reownBrandingTemplate()} `}reownBrandingTemplate(){return this.remoteFeatures?.reownBranding?u` <wui-flex flexDirection="column" .padding=${["1","0","1","0"]}>
      <wui-ux-by-reown></wui-ux-by-reown>
    </wui-flex>`:null}};no([m()],$t.prototype,"isMobile",void 0);no([m()],$t.prototype,"remoteFeatures",void 0);$t=no([f("w3m-connecting-wc-basic-view")],$t);a();a();a();a();a();a();a();a();var{I:Nu}=fo;var jr=t=>t.strings===void 0;var Xe=(t,e)=>{let o=t._$AN;if(o===void 0)return!1;for(let i of o)i._$AO?.(e,!1),Xe(i,e);return!0},vt=t=>{let e,o;do{if((e=t._$AM)===void 0)break;o=e._$AN,o.delete(t),t=e}while(o?.size===0)},zr=t=>{for(let e;e=t._$AM;t=e){let o=e._$AN;if(o===void 0)e._$AN=o=new Set;else if(o.has(t))break;o.add(t),cn(e)}};function ln(t){this._$AN!==void 0?(vt(this),this._$AM=t,zr(this)):this._$AM=t}function an(t,e=!1,o=0){let i=this._$AH,n=this._$AN;if(n!==void 0&&n.size!==0)if(e)if(Array.isArray(i))for(let r=o;r<i.length;r++)Xe(i[r],!1),vt(i[r]);else i!=null&&(Xe(i,!1),vt(i));else Xe(this,t)}var cn=t=>{t.type==wo.CHILD&&(t._$AP??(t._$AP=an),t._$AQ??(t._$AQ=ln))},Et=class extends bo{constructor(){super(...arguments),this._$AN=void 0}_$AT(e,o,i){super._$AT(e,o,i),zr(this),this.isConnected=e._$AU}_$AO(e,o=!0){e!==this.isConnected&&(this.isConnected=e,e?this.reconnected?.():this.disconnected?.()),o&&(Xe(this,e),vt(this))}setValue(e){if(jr(this._$Ct))this._$Ct._$AI(e,this);else{let o=[...this._$Ct._$AH];o[this._$Ci]=e,this._$Ct._$AI(o,this,0)}}disconnected(){}reconnected(){}};var De=()=>new lo,lo=class{},so=new WeakMap,Me=Pt(class extends Et{render(t){return Lt}update(t,[e]){let o=e!==this.G;return o&&this.rt(void 0),(o||this.lt!==this.ct)&&(this.G=e,this.ht=t.options?.host,this.rt(this.ct=t.element)),Lt}rt(t){if(this.G!==void 0)if(this.isConnected||(t=void 0),typeof this.G=="function"){let e=this.ht??globalThis,o=so.get(e);o===void 0&&(o=new WeakMap,so.set(e,o)),o.get(this.G)!==void 0&&this.G.call(this.ht,void 0),o.set(this.G,t),t!==void 0&&this.G.call(this.ht,t)}else this.G.value=t}get lt(){return typeof this.G=="function"?so.get(this.ht??globalThis)?.get(this.G):this.G?.value}disconnected(){this.lt===this.ct&&this.rt(void 0)}reconnected(){this.rt(this.ct)}});a();var qr=$`
  :host {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  label {
    position: relative;
    display: inline-block;
    user-select: none;
    transition:
      background-color ${({durations:t})=>t.lg}
        ${({easings:t})=>t["ease-out-power-2"]},
      color ${({durations:t})=>t.lg} ${({easings:t})=>t["ease-out-power-2"]},
      border ${({durations:t})=>t.lg} ${({easings:t})=>t["ease-out-power-2"]},
      box-shadow ${({durations:t})=>t.lg}
        ${({easings:t})=>t["ease-out-power-2"]},
      width ${({durations:t})=>t.lg} ${({easings:t})=>t["ease-out-power-2"]},
      height ${({durations:t})=>t.lg} ${({easings:t})=>t["ease-out-power-2"]},
      transform ${({durations:t})=>t.lg}
        ${({easings:t})=>t["ease-out-power-2"]},
      opacity ${({durations:t})=>t.lg} ${({easings:t})=>t["ease-out-power-2"]};
    will-change: background-color, color, border, box-shadow, width, height, transform, opacity;
  }

  input {
    width: 0;
    height: 0;
    opacity: 0;
  }

  span {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: ${({colors:t})=>t.neutrals300};
    border-radius: ${({borderRadius:t})=>t.round};
    border: 1px solid transparent;
    will-change: border;
    transition:
      background-color ${({durations:t})=>t.lg}
        ${({easings:t})=>t["ease-out-power-2"]},
      color ${({durations:t})=>t.lg} ${({easings:t})=>t["ease-out-power-2"]},
      border ${({durations:t})=>t.lg} ${({easings:t})=>t["ease-out-power-2"]},
      box-shadow ${({durations:t})=>t.lg}
        ${({easings:t})=>t["ease-out-power-2"]},
      width ${({durations:t})=>t.lg} ${({easings:t})=>t["ease-out-power-2"]},
      height ${({durations:t})=>t.lg} ${({easings:t})=>t["ease-out-power-2"]},
      transform ${({durations:t})=>t.lg}
        ${({easings:t})=>t["ease-out-power-2"]},
      opacity ${({durations:t})=>t.lg} ${({easings:t})=>t["ease-out-power-2"]};
    will-change: background-color, color, border, box-shadow, width, height, transform, opacity;
  }

  span:before {
    content: '';
    position: absolute;
    background-color: ${({colors:t})=>t.white};
    border-radius: 50%;
  }

  /* -- Sizes --------------------------------------------------------- */
  label[data-size='lg'] {
    width: 48px;
    height: 32px;
  }

  label[data-size='md'] {
    width: 40px;
    height: 28px;
  }

  label[data-size='sm'] {
    width: 32px;
    height: 22px;
  }

  label[data-size='lg'] > span:before {
    height: 24px;
    width: 24px;
    left: 4px;
    top: 3px;
  }

  label[data-size='md'] > span:before {
    height: 20px;
    width: 20px;
    left: 4px;
    top: 3px;
  }

  label[data-size='sm'] > span:before {
    height: 16px;
    width: 16px;
    left: 3px;
    top: 2px;
  }

  /* -- Focus states --------------------------------------------------- */
  input:focus-visible:not(:checked) + span,
  input:focus:not(:checked) + span {
    border: 1px solid ${({tokens:t})=>t.core.iconAccentPrimary};
    background-color: ${({tokens:t})=>t.theme.textTertiary};
    box-shadow: 0px 0px 0px 4px rgba(9, 136, 240, 0.2);
  }

  input:focus-visible:checked + span,
  input:focus:checked + span {
    border: 1px solid ${({tokens:t})=>t.core.iconAccentPrimary};
    box-shadow: 0px 0px 0px 4px rgba(9, 136, 240, 0.2);
  }

  /* -- Checked states --------------------------------------------------- */
  input:checked + span {
    background-color: ${({tokens:t})=>t.core.iconAccentPrimary};
  }

  label[data-size='lg'] > input:checked + span:before {
    transform: translateX(calc(100% - 9px));
  }

  label[data-size='md'] > input:checked + span:before {
    transform: translateX(calc(100% - 9px));
  }

  label[data-size='sm'] > input:checked + span:before {
    transform: translateX(calc(100% - 7px));
  }

  /* -- Hover states ------------------------------------------------------- */
  label:hover > input:not(:checked):not(:disabled) + span {
    background-color: ${({colors:t})=>t.neutrals400};
  }

  label:hover > input:checked:not(:disabled) + span {
    background-color: ${({colors:t})=>t.accent080};
  }

  /* -- Disabled state --------------------------------------------------- */
  label:has(input:disabled) {
    pointer-events: none;
    user-select: none;
  }

  input:not(:checked):disabled + span {
    background-color: ${({colors:t})=>t.neutrals700};
  }

  input:checked:disabled + span {
    background-color: ${({colors:t})=>t.neutrals700};
  }

  input:not(:checked):disabled + span::before {
    background-color: ${({colors:t})=>t.neutrals400};
  }

  input:checked:disabled + span::before {
    background-color: ${({tokens:t})=>t.theme.textTertiary};
  }
`;var Rt=function(t,e,o,i){var n=arguments.length,r=n<3?e:i===null?i=Object.getOwnPropertyDescriptor(e,o):i,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")r=Reflect.decorate(t,e,o,i);else for(var l=t.length-1;l>=0;l--)(s=t[l])&&(r=(n<3?s(r):n>3?s(e,o,r):s(e,o))||r);return n>3&&r&&Object.defineProperty(e,o,r),r},Ue=class extends w{constructor(){super(...arguments),this.inputElementRef=De(),this.checked=!1,this.disabled=!1,this.size="md"}render(){return u`
      <label data-size=${this.size}>
        <input
          ${Me(this.inputElementRef)}
          type="checkbox"
          ?checked=${this.checked}
          ?disabled=${this.disabled}
          @change=${this.dispatchChangeEvent.bind(this)}
        />
        <span></span>
      </label>
    `}dispatchChangeEvent(){this.dispatchEvent(new CustomEvent("switchChange",{detail:this.inputElementRef.value?.checked,bubbles:!0,composed:!0}))}};Ue.styles=[k,q,qr];Rt([h({type:Boolean})],Ue.prototype,"checked",void 0);Rt([h({type:Boolean})],Ue.prototype,"disabled",void 0);Rt([h()],Ue.prototype,"size",void 0);Ue=Rt([f("wui-toggle")],Ue);a();var Fr=$`
  :host {
    height: auto;
  }

  :host > wui-flex {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    column-gap: ${({spacing:t})=>t[2]};
    padding: ${({spacing:t})=>t[2]} ${({spacing:t})=>t[3]};
    background-color: ${({tokens:t})=>t.theme.foregroundPrimary};
    border-radius: ${({borderRadius:t})=>t[4]};
    box-shadow: inset 0 0 0 1px ${({tokens:t})=>t.theme.foregroundPrimary};
    transition: background-color ${({durations:t})=>t.lg}
      ${({easings:t})=>t["ease-out-power-2"]};
    will-change: background-color;
    cursor: pointer;
  }

  wui-switch {
    pointer-events: none;
  }
`;var Vr=function(t,e,o,i){var n=arguments.length,r=n<3?e:i===null?i=Object.getOwnPropertyDescriptor(e,o):i,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")r=Reflect.decorate(t,e,o,i);else for(var l=t.length-1;l>=0;l--)(s=t[l])&&(r=(n<3?s(r):n>3?s(e,o,r):s(e,o))||r);return n>3&&r&&Object.defineProperty(e,o,r),r},St=class extends w{constructor(){super(...arguments),this.checked=!1}render(){return u`
      <wui-flex>
        <wui-icon size="xl" name="walletConnectBrown"></wui-icon>
        <wui-toggle
          ?checked=${this.checked}
          size="sm"
          @switchChange=${this.handleToggleChange.bind(this)}
        ></wui-toggle>
      </wui-flex>
    `}handleToggleChange(e){e.stopPropagation(),this.checked=e.detail,this.dispatchSwitchEvent()}dispatchSwitchEvent(){this.dispatchEvent(new CustomEvent("certifiedSwitchChange",{detail:this.checked,bubbles:!0,composed:!0}))}};St.styles=[k,q,Fr];Vr([h({type:Boolean})],St.prototype,"checked",void 0);St=Vr([f("wui-certified-switch")],St);a();a();a();a();var Hr=$`
  :host {
    position: relative;
    width: 100%;
    display: inline-flex;
    flex-direction: column;
    gap: ${({spacing:t})=>t[3]};
    color: ${({tokens:t})=>t.theme.textPrimary};
    caret-color: ${({tokens:t})=>t.core.textAccentPrimary};
  }

  .wui-input-text-container {
    position: relative;
    display: flex;
  }

  input {
    width: 100%;
    border-radius: ${({borderRadius:t})=>t[4]};
    color: inherit;
    background: transparent;
    border: 1px solid ${({tokens:t})=>t.theme.borderPrimary};
    caret-color: ${({tokens:t})=>t.core.textAccentPrimary};
    padding: ${({spacing:t})=>t[3]} ${({spacing:t})=>t[3]}
      ${({spacing:t})=>t[3]} ${({spacing:t})=>t[10]};
    font-size: ${({textSize:t})=>t.large};
    line-height: ${({typography:t})=>t["lg-regular"].lineHeight};
    letter-spacing: ${({typography:t})=>t["lg-regular"].letterSpacing};
    font-weight: ${({fontWeight:t})=>t.regular};
    font-family: ${({fontFamily:t})=>t.regular};
  }

  input[data-size='lg'] {
    padding: ${({spacing:t})=>t[4]} ${({spacing:t})=>t[3]}
      ${({spacing:t})=>t[4]} ${({spacing:t})=>t[10]};
  }

  @media (hover: hover) and (pointer: fine) {
    input:hover:enabled {
      border: 1px solid ${({tokens:t})=>t.theme.borderSecondary};
    }
  }

  input:disabled {
    cursor: unset;
    border: 1px solid ${({tokens:t})=>t.theme.borderPrimary};
  }

  input::placeholder {
    color: ${({tokens:t})=>t.theme.textSecondary};
  }

  input:focus:enabled {
    border: 1px solid ${({tokens:t})=>t.theme.borderSecondary};
    background-color: ${({tokens:t})=>t.theme.foregroundPrimary};
    -webkit-box-shadow: 0px 0px 0px 4px ${({tokens:t})=>t.core.foregroundAccent040};
    -moz-box-shadow: 0px 0px 0px 4px ${({tokens:t})=>t.core.foregroundAccent040};
    box-shadow: 0px 0px 0px 4px ${({tokens:t})=>t.core.foregroundAccent040};
  }

  div.wui-input-text-container:has(input:disabled) {
    opacity: 0.5;
  }

  wui-icon.wui-input-text-left-icon {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
    left: ${({spacing:t})=>t[4]};
    color: ${({tokens:t})=>t.theme.iconDefault};
  }

  button.wui-input-text-submit-button {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    right: ${({spacing:t})=>t[3]};
    width: 24px;
    height: 24px;
    border: none;
    background: transparent;
    border-radius: ${({borderRadius:t})=>t[2]};
    color: ${({tokens:t})=>t.core.textAccentPrimary};
  }

  button.wui-input-text-submit-button:disabled {
    opacity: 1;
  }

  button.wui-input-text-submit-button.loading wui-icon {
    animation: spin 1s linear infinite;
  }

  button.wui-input-text-submit-button:hover {
    background: ${({tokens:t})=>t.core.foregroundAccent010};
  }

  input:has(+ .wui-input-text-submit-button) {
    padding-right: ${({spacing:t})=>t[12]};
  }

  input[type='number'] {
    -moz-appearance: textfield;
  }

  input[type='search']::-webkit-search-decoration,
  input[type='search']::-webkit-search-cancel-button,
  input[type='search']::-webkit-search-results-button,
  input[type='search']::-webkit-search-results-decoration {
    -webkit-appearance: none;
  }

  /* -- Keyframes --------------------------------------------------- */
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`;var Y=function(t,e,o,i){var n=arguments.length,r=n<3?e:i===null?i=Object.getOwnPropertyDescriptor(e,o):i,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")r=Reflect.decorate(t,e,o,i);else for(var l=t.length-1;l>=0;l--)(s=t[l])&&(r=(n<3?s(r):n>3?s(e,o,r):s(e,o))||r);return n>3&&r&&Object.defineProperty(e,o,r),r},F=class extends w{constructor(){super(...arguments),this.inputElementRef=De(),this.disabled=!1,this.loading=!1,this.placeholder="",this.type="text",this.value="",this.size="md"}render(){return u` <div class="wui-input-text-container">
        ${this.templateLeftIcon()}
        <input
          data-size=${this.size}
          ${Me(this.inputElementRef)}
          data-testid="wui-input-text"
          type=${this.type}
          enterkeyhint=${E(this.enterKeyHint)}
          ?disabled=${this.disabled}
          placeholder=${this.placeholder}
          @input=${this.dispatchInputChangeEvent.bind(this)}
          @keydown=${this.onKeyDown}
          .value=${this.value||""}
        />
        ${this.templateSubmitButton()}
        <slot class="wui-input-text-slot"></slot>
      </div>
      ${this.templateError()} ${this.templateWarning()}`}templateLeftIcon(){return this.icon?u`<wui-icon
        class="wui-input-text-left-icon"
        size="md"
        data-size=${this.size}
        color="inherit"
        name=${this.icon}
      ></wui-icon>`:null}templateSubmitButton(){return this.onSubmit?u`<button
        class="wui-input-text-submit-button ${this.loading?"loading":""}"
        @click=${this.onSubmit?.bind(this)}
        ?disabled=${this.disabled||this.loading}
      >
        ${this.loading?u`<wui-icon name="spinner" size="md"></wui-icon>`:u`<wui-icon name="chevronRight" size="md"></wui-icon>`}
      </button>`:null}templateError(){return this.errorText?u`<wui-text variant="sm-regular" color="error">${this.errorText}</wui-text>`:null}templateWarning(){return this.warningText?u`<wui-text variant="sm-regular" color="warning">${this.warningText}</wui-text>`:null}dispatchInputChangeEvent(){this.dispatchEvent(new CustomEvent("inputChange",{detail:this.inputElementRef.value?.value,bubbles:!0,composed:!0}))}};F.styles=[k,q,Hr];Y([h()],F.prototype,"icon",void 0);Y([h({type:Boolean})],F.prototype,"disabled",void 0);Y([h({type:Boolean})],F.prototype,"loading",void 0);Y([h()],F.prototype,"placeholder",void 0);Y([h()],F.prototype,"type",void 0);Y([h()],F.prototype,"value",void 0);Y([h()],F.prototype,"errorText",void 0);Y([h()],F.prototype,"warningText",void 0);Y([h()],F.prototype,"onSubmit",void 0);Y([h()],F.prototype,"size",void 0);Y([h({attribute:!1})],F.prototype,"onKeyDown",void 0);F=Y([f("wui-input-text")],F);a();var Kr=$`
  :host {
    position: relative;
    display: inline-block;
    width: 100%;
  }

  wui-icon {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    right: ${({spacing:t})=>t[3]};
    color: ${({tokens:t})=>t.theme.iconDefault};
    cursor: pointer;
    padding: ${({spacing:t})=>t[2]};
    background-color: transparent;
    border-radius: ${({borderRadius:t})=>t[4]};
    transition: background-color ${({durations:t})=>t.lg}
      ${({easings:t})=>t["ease-out-power-2"]};
  }

  @media (hover: hover) {
    wui-icon:hover {
      background-color: ${({tokens:t})=>t.theme.foregroundSecondary};
    }
  }
`;var Gr=function(t,e,o,i){var n=arguments.length,r=n<3?e:i===null?i=Object.getOwnPropertyDescriptor(e,o):i,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")r=Reflect.decorate(t,e,o,i);else for(var l=t.length-1;l>=0;l--)(s=t[l])&&(r=(n<3?s(r):n>3?s(e,o,r):s(e,o))||r);return n>3&&r&&Object.defineProperty(e,o,r),r},_t=class extends w{constructor(){super(...arguments),this.inputComponentRef=De(),this.inputValue=""}render(){return u`
      <wui-input-text
        ${Me(this.inputComponentRef)}
        placeholder="Search wallet"
        icon="search"
        type="search"
        enterKeyHint="search"
        size="sm"
        @inputChange=${this.onInputChange}
      >
        ${this.inputValue?u`<wui-icon
              @click=${this.clearValue}
              color="inherit"
              size="sm"
              name="close"
            ></wui-icon>`:null}
      </wui-input-text>
    `}onInputChange(e){this.inputValue=e.detail||""}clearValue(){let o=this.inputComponentRef.value?.inputElementRef.value;o&&(o.value="",this.inputValue="",o.focus(),o.dispatchEvent(new Event("input")))}};_t.styles=[k,Kr];Gr([h()],_t.prototype,"inputValue",void 0);_t=Gr([f("wui-search-bar")],_t);a();a();a();a();var Qr=$`
  :host {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 104px;
    width: 104px;
    row-gap: ${({spacing:t})=>t[2]};
    background-color: ${({tokens:t})=>t.theme.foregroundPrimary};
    border-radius: ${({borderRadius:t})=>t[5]};
    position: relative;
  }

  wui-shimmer[data-type='network'] {
    border: none;
    -webkit-clip-path: var(--apkt-path-network);
    clip-path: var(--apkt-path-network);
  }

  svg {
    position: absolute;
    width: 48px;
    height: 54px;
    z-index: 1;
  }

  svg > path {
    stroke: ${({tokens:t})=>t.theme.foregroundSecondary};
    stroke-width: 1px;
  }

  @media (max-width: 350px) {
    :host {
      width: 100%;
    }
  }
`;var Jr=function(t,e,o,i){var n=arguments.length,r=n<3?e:i===null?i=Object.getOwnPropertyDescriptor(e,o):i,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")r=Reflect.decorate(t,e,o,i);else for(var l=t.length-1;l>=0;l--)(s=t[l])&&(r=(n<3?s(r):n>3?s(e,o,r):s(e,o))||r);return n>3&&r&&Object.defineProperty(e,o,r),r},At=class extends w{constructor(){super(...arguments),this.type="wallet"}render(){return u`
      ${this.shimmerTemplate()}
      <wui-shimmer width="80px" height="20px"></wui-shimmer>
    `}shimmerTemplate(){return this.type==="network"?u` <wui-shimmer data-type=${this.type} width="48px" height="54px"></wui-shimmer>
        ${yo}`:u`<wui-shimmer width="56px" height="56px"></wui-shimmer>`}};At.styles=[k,q,Qr];Jr([h()],At.prototype,"type",void 0);At=Jr([f("wui-card-select-loader")],At);a();a();a();var Yr=nt`
  :host {
    display: grid;
    width: inherit;
    height: inherit;
  }
`;var X=function(t,e,o,i){var n=arguments.length,r=n<3?e:i===null?i=Object.getOwnPropertyDescriptor(e,o):i,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")r=Reflect.decorate(t,e,o,i);else for(var l=t.length-1;l>=0;l--)(s=t[l])&&(r=(n<3?s(r):n>3?s(e,o,r):s(e,o))||r);return n>3&&r&&Object.defineProperty(e,o,r),r},V=class extends w{render(){return this.style.cssText=`
      grid-template-rows: ${this.gridTemplateRows};
      grid-template-columns: ${this.gridTemplateColumns};
      justify-items: ${this.justifyItems};
      align-items: ${this.alignItems};
      justify-content: ${this.justifyContent};
      align-content: ${this.alignContent};
      column-gap: ${this.columnGap&&`var(--apkt-spacing-${this.columnGap})`};
      row-gap: ${this.rowGap&&`var(--apkt-spacing-${this.rowGap})`};
      gap: ${this.gap&&`var(--apkt-spacing-${this.gap})`};
      padding-top: ${this.padding&&ee.getSpacingStyles(this.padding,0)};
      padding-right: ${this.padding&&ee.getSpacingStyles(this.padding,1)};
      padding-bottom: ${this.padding&&ee.getSpacingStyles(this.padding,2)};
      padding-left: ${this.padding&&ee.getSpacingStyles(this.padding,3)};
      margin-top: ${this.margin&&ee.getSpacingStyles(this.margin,0)};
      margin-right: ${this.margin&&ee.getSpacingStyles(this.margin,1)};
      margin-bottom: ${this.margin&&ee.getSpacingStyles(this.margin,2)};
      margin-left: ${this.margin&&ee.getSpacingStyles(this.margin,3)};
    `,u`<slot></slot>`}};V.styles=[k,Yr];X([h()],V.prototype,"gridTemplateRows",void 0);X([h()],V.prototype,"gridTemplateColumns",void 0);X([h()],V.prototype,"justifyItems",void 0);X([h()],V.prototype,"alignItems",void 0);X([h()],V.prototype,"justifyContent",void 0);X([h()],V.prototype,"alignContent",void 0);X([h()],V.prototype,"columnGap",void 0);X([h()],V.prototype,"rowGap",void 0);X([h()],V.prototype,"gap",void 0);X([h()],V.prototype,"padding",void 0);X([h()],V.prototype,"margin",void 0);V=X([f("wui-grid")],V);a();a();var Xr=$`
  button {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    width: 104px;
    row-gap: ${({spacing:t})=>t[2]};
    padding: ${({spacing:t})=>t[3]} ${({spacing:t})=>t[0]};
    background-color: ${({tokens:t})=>t.theme.foregroundPrimary};
    border-radius: clamp(0px, ${({borderRadius:t})=>t[4]}, 20px);
    transition:
      color ${({durations:t})=>t.lg} ${({easings:t})=>t["ease-out-power-1"]},
      background-color ${({durations:t})=>t.lg}
        ${({easings:t})=>t["ease-out-power-1"]},
      border-radius ${({durations:t})=>t.lg}
        ${({easings:t})=>t["ease-out-power-1"]};
    will-change: background-color, color, border-radius;
    outline: none;
    border: none;
  }

  button > wui-flex > wui-text {
    color: ${({tokens:t})=>t.theme.textPrimary};
    max-width: 86px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    justify-content: center;
  }

  button > wui-flex > wui-text.certified {
    max-width: 66px;
  }

  @media (hover: hover) and (pointer: fine) {
    button:hover:enabled {
      background-color: ${({tokens:t})=>t.theme.foregroundSecondary};
    }
  }

  button:disabled > wui-flex > wui-text {
    color: ${({tokens:t})=>t.core.glass010};
  }

  [data-selected='true'] {
    background-color: ${({colors:t})=>t.accent020};
  }

  @media (hover: hover) and (pointer: fine) {
    [data-selected='true']:hover:enabled {
      background-color: ${({colors:t})=>t.accent010};
    }
  }

  [data-selected='true']:active:enabled {
    background-color: ${({colors:t})=>t.accent010};
  }

  @media (max-width: 350px) {
    button {
      width: 100%;
    }
  }
`;var re=function(t,e,o,i){var n=arguments.length,r=n<3?e:i===null?i=Object.getOwnPropertyDescriptor(e,o):i,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")r=Reflect.decorate(t,e,o,i);else for(var l=t.length-1;l>=0;l--)(s=t[l])&&(r=(n<3?s(r):n>3?s(e,o,r):s(e,o))||r);return n>3&&r&&Object.defineProperty(e,o,r),r},Z=class extends w{constructor(){super(),this.observer=new IntersectionObserver(()=>{}),this.visible=!1,this.imageSrc=void 0,this.imageLoading=!1,this.isImpressed=!1,this.explorerId="",this.walletQuery="",this.certified=!1,this.displayIndex=0,this.wallet=void 0,this.observer=new IntersectionObserver(e=>{e.forEach(o=>{o.isIntersecting?(this.visible=!0,this.fetchImageSrc(),this.sendImpressionEvent()):this.visible=!1})},{threshold:.01})}firstUpdated(){this.observer.observe(this)}disconnectedCallback(){this.observer.disconnect()}render(){let e=this.wallet?.badge_type==="certified";return u`
      <button>
        ${this.imageTemplate()}
        <wui-flex flexDirection="row" alignItems="center" justifyContent="center" gap="1">
          <wui-text
            variant="md-regular"
            color="inherit"
            class=${E(e?"certified":void 0)}
            >${this.wallet?.name}</wui-text
          >
          ${e?u`<wui-icon size="sm" name="walletConnectBrown"></wui-icon>`:null}
        </wui-flex>
      </button>
    `}imageTemplate(){return!this.visible&&!this.imageSrc||this.imageLoading?this.shimmerTemplate():u`
      <wui-wallet-image
        size="lg"
        imageSrc=${E(this.imageSrc)}
        name=${E(this.wallet?.name)}
        .installed=${this.wallet?.installed??!1}
        badgeSize="sm"
      >
      </wui-wallet-image>
    `}shimmerTemplate(){return u`<wui-shimmer width="56px" height="56px"></wui-shimmer>`}async fetchImageSrc(){this.wallet&&(this.imageSrc=K.getWalletImage(this.wallet),!this.imageSrc&&(this.imageLoading=!0,this.imageSrc=await K.fetchWalletImage(this.wallet.image_id),this.imageLoading=!1))}sendImpressionEvent(){!this.wallet||this.isImpressed||(this.isImpressed=!0,P.sendWalletImpressionEvent({name:this.wallet.name,walletRank:this.wallet.order,explorerId:this.explorerId,view:b.state.view,query:this.walletQuery,certified:this.certified,displayIndex:this.displayIndex}))}};Z.styles=Xr;re([m()],Z.prototype,"visible",void 0);re([m()],Z.prototype,"imageSrc",void 0);re([m()],Z.prototype,"imageLoading",void 0);re([m()],Z.prototype,"isImpressed",void 0);re([h()],Z.prototype,"explorerId",void 0);re([h()],Z.prototype,"walletQuery",void 0);re([h()],Z.prototype,"certified",void 0);re([h()],Z.prototype,"displayIndex",void 0);re([h({type:Object})],Z.prototype,"wallet",void 0);Z=re([f("w3m-all-wallets-list-item")],Z);a();var Zr=$`
  wui-grid {
    max-height: clamp(360px, 400px, 80vh);
    overflow: scroll;
    scrollbar-width: none;
    grid-auto-rows: min-content;
    grid-template-columns: repeat(auto-fill, 104px);
  }

  :host([data-mobile-fullscreen='true']) wui-grid {
    max-height: none;
  }

  @media (max-width: 350px) {
    wui-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  wui-grid[data-scroll='false'] {
    overflow: hidden;
  }

  wui-grid::-webkit-scrollbar {
    display: none;
  }

  w3m-all-wallets-list-item {
    opacity: 0;
    animation-duration: ${({durations:t})=>t.xl};
    animation-timing-function: ${({easings:t})=>t["ease-inout-power-2"]};
    animation-name: fade-in;
    animation-fill-mode: forwards;
  }

  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  wui-loading-spinner {
    padding-top: ${({spacing:t})=>t[4]};
    padding-bottom: ${({spacing:t})=>t[4]};
    justify-content: center;
    grid-column: 1 / span 4;
  }
`;var Ze=function(t,e,o,i){var n=arguments.length,r=n<3?e:i===null?i=Object.getOwnPropertyDescriptor(e,o):i,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")r=Reflect.decorate(t,e,o,i);else for(var l=t.length-1;l>=0;l--)(s=t[l])&&(r=(n<3?s(r):n>3?s(e,o,r):s(e,o))||r);return n>3&&r&&Object.defineProperty(e,o,r),r},ei="local-paginator",Ee=class extends w{constructor(){super(),this.unsubscribe=[],this.paginationObserver=void 0,this.loading=!I.state.wallets.length,this.wallets=I.state.wallets,this.mobileFullScreen=N.state.enableMobileFullScreen,this.unsubscribe.push(I.subscribeKey("wallets",e=>this.wallets=e))}firstUpdated(){this.initialFetch(),this.createPaginationObserver()}disconnectedCallback(){this.unsubscribe.forEach(e=>e()),this.paginationObserver?.disconnect()}render(){return this.mobileFullScreen&&this.setAttribute("data-mobile-fullscreen","true"),u`
      <wui-grid
        data-scroll=${!this.loading}
        .padding=${["0","3","3","3"]}
        gap="2"
        justifyContent="space-between"
      >
        ${this.loading?this.shimmerTemplate(16):this.walletsTemplate()}
        ${this.paginationLoaderTemplate()}
      </wui-grid>
    `}async initialFetch(){this.loading=!0;let e=this.shadowRoot?.querySelector("wui-grid");e&&(await I.fetchWalletsByPage({page:1}),await e.animate([{opacity:1},{opacity:0}],{duration:200,fill:"forwards",easing:"ease"}).finished,this.loading=!1,e.animate([{opacity:0},{opacity:1}],{duration:200,fill:"forwards",easing:"ease"}))}shimmerTemplate(e,o){return[...Array(e)].map(()=>u`
        <wui-card-select-loader type="wallet" id=${E(o)}></wui-card-select-loader>
      `)}walletsTemplate(){return ze.getWalletConnectWallets(this.wallets).map((e,o)=>u`
        <w3m-all-wallets-list-item
          data-testid="wallet-search-item-${e.id}"
          @click=${()=>this.onConnectWallet(e)}
          .wallet=${e}
          explorerId=${e.id}
          certified=${this.badge==="certified"}
          displayIndex=${o}
        ></w3m-all-wallets-list-item>
      `)}paginationLoaderTemplate(){let{wallets:e,recommended:o,featured:i,count:n,mobileFilteredOutWalletsLength:r}=I.state,s=window.innerWidth<352?3:4,l=e.length+o.length,g=Math.ceil(l/s)*s-l+s;return g-=e.length?i.length%s:0,n===0&&i.length>0?null:n===0||[...i,...e,...o].length<n-(r??0)?this.shimmerTemplate(g,ei):null}createPaginationObserver(){let e=this.shadowRoot?.querySelector(`#${ei}`);e&&(this.paginationObserver=new IntersectionObserver(([o])=>{if(o?.isIntersecting&&!this.loading){let{page:i,count:n,wallets:r}=I.state;r.length<n&&I.fetchWalletsByPage({page:i+1})}}),this.paginationObserver.observe(e))}onConnectWallet(e){z.selectWalletConnector(e)}};Ee.styles=Zr;Ze([m()],Ee.prototype,"loading",void 0);Ze([m()],Ee.prototype,"wallets",void 0);Ze([m()],Ee.prototype,"badge",void 0);Ze([m()],Ee.prototype,"mobileFullScreen",void 0);Ee=Ze([f("w3m-all-wallets-list")],Ee);a();a();var ti=nt`
  wui-grid,
  wui-loading-spinner,
  wui-flex {
    height: 360px;
  }

  wui-grid {
    overflow: scroll;
    scrollbar-width: none;
    grid-auto-rows: min-content;
    grid-template-columns: repeat(auto-fill, 104px);
  }

  :host([data-mobile-fullscreen='true']) wui-grid {
    max-height: none;
    height: auto;
  }

  wui-grid[data-scroll='false'] {
    overflow: hidden;
  }

  wui-grid::-webkit-scrollbar {
    display: none;
  }

  wui-loading-spinner {
    justify-content: center;
    align-items: center;
  }

  @media (max-width: 350px) {
    wui-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
`;var et=function(t,e,o,i){var n=arguments.length,r=n<3?e:i===null?i=Object.getOwnPropertyDescriptor(e,o):i,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")r=Reflect.decorate(t,e,o,i);else for(var l=t.length-1;l>=0;l--)(s=t[l])&&(r=(n<3?s(r):n>3?s(e,o,r):s(e,o))||r);return n>3&&r&&Object.defineProperty(e,o,r),r},Re=class extends w{constructor(){super(...arguments),this.prevQuery="",this.prevBadge=void 0,this.loading=!0,this.mobileFullScreen=N.state.enableMobileFullScreen,this.query=""}render(){return this.mobileFullScreen&&this.setAttribute("data-mobile-fullscreen","true"),this.onSearch(),this.loading?u`<wui-loading-spinner color="accent-primary"></wui-loading-spinner>`:this.walletsTemplate()}async onSearch(){(this.query.trim()!==this.prevQuery.trim()||this.badge!==this.prevBadge)&&(this.prevQuery=this.query,this.prevBadge=this.badge,this.loading=!0,await I.searchWallet({search:this.query,badge:this.badge}),this.loading=!1)}walletsTemplate(){let{search:e}=I.state,o=ze.markWalletsAsInstalled(e),i=ze.filterWalletsByWcSupport(o);return i.length?u`
      <wui-grid
        data-testid="wallet-list"
        .padding=${["0","3","3","3"]}
        rowGap="4"
        columngap="2"
        justifyContent="space-between"
      >
        ${i.map((n,r)=>u`
            <w3m-all-wallets-list-item
              @click=${()=>this.onConnectWallet(n)}
              .wallet=${n}
              data-testid="wallet-search-item-${n.id}"
              explorerId=${n.id}
              certified=${this.badge==="certified"}
              walletQuery=${this.query}
              displayIndex=${r}
            ></w3m-all-wallets-list-item>
          `)}
      </wui-grid>
    `:u`
        <wui-flex
          data-testid="no-wallet-found"
          justifyContent="center"
          alignItems="center"
          gap="3"
          flexDirection="column"
        >
          <wui-icon-box size="lg" color="default" icon="wallet"></wui-icon-box>
          <wui-text data-testid="no-wallet-found-text" color="secondary" variant="md-medium">
            No Wallet found
          </wui-text>
        </wui-flex>
      `}onConnectWallet(e){z.selectWalletConnector(e)}};Re.styles=ti;et([m()],Re.prototype,"loading",void 0);et([m()],Re.prototype,"mobileFullScreen",void 0);et([h()],Re.prototype,"query",void 0);et([h()],Re.prototype,"badge",void 0);Re=et([f("w3m-all-wallets-search")],Re);var ao=function(t,e,o,i){var n=arguments.length,r=n<3?e:i===null?i=Object.getOwnPropertyDescriptor(e,o):i,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")r=Reflect.decorate(t,e,o,i);else for(var l=t.length-1;l>=0;l--)(s=t[l])&&(r=(n<3?s(r):n>3?s(e,o,r):s(e,o))||r);return n>3&&r&&Object.defineProperty(e,o,r),r},Tt=class extends w{constructor(){super(...arguments),this.search="",this.badge=void 0,this.onDebouncedSearch=C.debounce(e=>{this.search=e})}render(){let e=this.search.length>=2;return u`
      <wui-flex .padding=${["1","3","3","3"]} gap="2" alignItems="center">
        <wui-search-bar @inputChange=${this.onInputChange.bind(this)}></wui-search-bar>
        <wui-certified-switch
          ?checked=${this.badge==="certified"}
          @certifiedSwitchChange=${this.onCertifiedSwitchChange.bind(this)}
          data-testid="wui-certified-switch"
        ></wui-certified-switch>
        ${this.qrButtonTemplate()}
      </wui-flex>
      ${e||this.badge?u`<w3m-all-wallets-search
            query=${this.search}
            .badge=${this.badge}
          ></w3m-all-wallets-search>`:u`<w3m-all-wallets-list .badge=${this.badge}></w3m-all-wallets-list>`}
    `}onInputChange(e){this.onDebouncedSearch(e.detail)}onCertifiedSwitchChange(e){e.detail?(this.badge="certified",ae.showSvg("Only WalletConnect certified",{icon:"walletConnectBrown",iconColor:"accent-100"})):this.badge=void 0}qrButtonTemplate(){return C.isMobile()?u`
        <wui-icon-box
          size="xl"
          iconSize="xl"
          color="accent-primary"
          icon="qrCode"
          border
          borderColor="wui-accent-glass-010"
          @click=${this.onWalletConnectQr.bind(this)}
        ></wui-icon-box>
      `:null}onWalletConnectQr(){b.push("ConnectingWalletConnect")}};ao([m()],Tt.prototype,"search",void 0);ao([m()],Tt.prototype,"badge",void 0);Tt=ao([f("w3m-all-wallets-view")],Tt);a();var un=function(t,e,o,i){var n=arguments.length,r=n<3?e:i===null?i=Object.getOwnPropertyDescriptor(e,o):i,s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")r=Reflect.decorate(t,e,o,i);else for(var l=t.length-1;l>=0;l--)(s=t[l])&&(r=(n<3?s(r):n>3?s(e,o,r):s(e,o))||r);return n>3&&r&&Object.defineProperty(e,o,r),r},oi=class extends w{constructor(){super(...arguments),this.wallet=b.state.data?.wallet}render(){if(!this.wallet)throw new Error("w3m-downloads-view");return u`
      <wui-flex gap="2" flexDirection="column" .padding=${["3","3","4","3"]}>
        ${this.chromeTemplate()} ${this.iosTemplate()} ${this.androidTemplate()}
        ${this.homepageTemplate()}
      </wui-flex>
    `}chromeTemplate(){return this.wallet?.chrome_store?u`<wui-list-item
      variant="icon"
      icon="chromeStore"
      iconVariant="square"
      @click=${this.onChromeStore.bind(this)}
      chevron
    >
      <wui-text variant="md-medium" color="primary">Chrome Extension</wui-text>
    </wui-list-item>`:null}iosTemplate(){return this.wallet?.app_store?u`<wui-list-item
      variant="icon"
      icon="appStore"
      iconVariant="square"
      @click=${this.onAppStore.bind(this)}
      chevron
    >
      <wui-text variant="md-medium" color="primary">iOS App</wui-text>
    </wui-list-item>`:null}androidTemplate(){return this.wallet?.play_store?u`<wui-list-item
      variant="icon"
      icon="playStore"
      iconVariant="square"
      @click=${this.onPlayStore.bind(this)}
      chevron
    >
      <wui-text variant="md-medium" color="primary">Android App</wui-text>
    </wui-list-item>`:null}homepageTemplate(){return this.wallet?.homepage?u`
      <wui-list-item
        variant="icon"
        icon="browser"
        iconVariant="square-blue"
        @click=${this.onHomePage.bind(this)}
        chevron
      >
        <wui-text variant="md-medium" color="primary">Website</wui-text>
      </wui-list-item>
    `:null}openStore(e){e.href&&this.wallet&&(P.sendEvent({type:"track",event:"GET_WALLET",properties:{name:this.wallet.name,walletRank:this.wallet.order,explorerId:this.wallet.id,type:e.type}}),C.openHref(e.href,"_blank"))}onChromeStore(){this.wallet?.chrome_store&&this.openStore({href:this.wallet.chrome_store,type:"chrome_store"})}onAppStore(){this.wallet?.app_store&&this.openStore({href:this.wallet.app_store,type:"app_store"})}onPlayStore(){this.wallet?.play_store&&this.openStore({href:this.wallet.play_store,type:"play_store"})}onHomePage(){this.wallet?.homepage&&this.openStore({href:this.wallet.homepage,type:"homepage"})}};oi=un([f("w3m-downloads-view")],oi);export{Tt as W3mAllWalletsView,$t as W3mConnectingWcBasicView,oi as W3mDownloadsView};
/*! Bundled license information:

lit-html/directive-helpers.js:
  (**
   * @license
   * Copyright 2020 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

lit-html/async-directive.js:
  (**
   * @license
   * Copyright 2017 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)

lit-html/directives/ref.js:
  (**
   * @license
   * Copyright 2020 Google LLC
   * SPDX-License-Identifier: BSD-3-Clause
   *)
*/
//# sourceMappingURL=basic-ARAB3PQA.js.map
