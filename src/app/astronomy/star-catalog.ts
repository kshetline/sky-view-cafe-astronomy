/*
  Copyright © 2017 Kerry Shetline, kerry@shetline.com

  MIT license: https://opensource.org/licenses/MIT

  Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
  documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
  rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit
  persons to whom the Software is furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all copies or substantial portions of the
  Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
  WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
  COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
  OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

import { AstroDataService } from './astro-data.service';
import { ArrayBufferReader } from 'array-buffer-reader';
import { abs, cos, mod, PI, sign, sin, sin_deg, SphericalPosition, tan, to_radian, Unit } from 'ks-math';
import { ABERRATION, JD_J2000, NO_PRECESSION, NUTATION, OBLIQUITY_J2000, UNKNOWN_MAGNITUDE } from './astro-constants';
import { Ecliptic, NMode } from './ecliptic';
import { ISkyObserver } from './i-sky-observer';
import { UT_to_TDB } from './ut-converter';

enum READING {FK5, BSC, HIP, DSO}
enum MARKER {INC_FK5 = 0xFF, NEW_STATE = 0xFE, DBL_PREC  = 0xFD, SNG_PREC = 0xFC}

export interface StarInfo
{
  bayerRank: number;
  bscNum: number;
  flamsteed: number;
  codedName: string;
  constellation: number;
  DE: number;
  duplicateName: boolean;
  fk5Num: number;
  hipNum: number;
  messierNum: number;
  name: string;
  ngcIcNum: number;
  pmDE: number; // in arcseconds/century
  pmRA: number; // in seconds (of hour angle)/century
  RA: number;
  subIndex: number;
  vmag: number;
}

export interface ConstellationInfo {
  name: string;
  code: string;
  starList: number[];
}

interface CacheEntry
{
  flags: number;
  pos: SphericalPosition;
  time: number;
}

const CONSTELLATION_LINES =
`And~Andromeda~Gam,Bet,Del,Alp,Pi,Mu,Xi,51
Ant~Antlia~Iot,Alp,The,Eps
Aps~Apus~Bet,Gam,Del-1,Alp
Aql~Aquila~12,Lam,Del,The,Bet,Alp,Gam,Zet,Del;Zet,Eps
Aqr~Aquarius~88,Del,Tau-2,Lam,Phi,Eta,Zet,Gam,Alp,Bet,Mu,Eps;Iot,The,Alp
Ara~Ara~Del,Gam,Bet,Alp,Eps-1,Zet,Eta;Gam,Zet;The,Alp
Ari~Aries~41,Alp,Bet,Gam
Aur~Auriga~Alp,Eps,Eta,Iot,Bet (Tau),The,Bet,Alp
Boo~Boötes~Zet,Alp,Eps,Del,Bet,Gam,Rho,Alp,Eta
Cae~Caelum~Alp,Bet
Cam~Camelopardalis~7,Bet,Alp,Gam;Alp,36,43
Cap~Capricornus~Alp-1,Bet,Psi,Ome,24,Zet,Eps,Del,Gam,Iot,The,Bet
Car~Carina~Ups,Bet,Ome,The,FK5:397,FK5:1264,Iot,Eps,Chi,Alp
Cas~Cassiopeia~Eps,Del,Gam,Alp,Bet
Cen~Centaurus~Kap,Eta,Nu,BSC:5089,Iot;The,Nu,Mu,Zet,Eps,Alp;Bet,Eps,Gam,Sig,Del,Rho,Pi,FK5:443,Lam
Cep~Cepheus~Del,Eps,Zet,Iot,Gam,Bet,Alp,Zet;Alp,Eta,The
Cet~Cetus~Gam,Alp,Lam,Mu,Xi-2,Nu,Gam,Del,Omi,Zet,Tau,Bet,Iot,Eta,The,Zet
Cha~Chamaeleon~Bet,Gam,Alp,The,Del-2
Cir~Circinus~Gam,Alp,Bet
CMa~Canis Major~Eta,Del,Omi-2,Alp,Bet;Eps,Sig,Alp
CMi~Canis Minor~Alp,Bet
Cnc~Cancer~Alp,Del,Iot;Del,Bet
Col~Columba~Del,Kap,Gam,Bet,Eta;Bet,Alp,Eps
Com~Coma Berenices~Alp,Bet,Gam
CrA~Corona Australis~Zet,Del,Bet,Alp,Gam,Eps
CrB~Corona Borealis~Iot,Eps,Del,Gam,Alp,Bet,The
Crt~Crater~Eta,Zet,Gam,Del,Eps,The;Gam,Bet,Alp,Del
Cru~Crux~Alp,Gam;Bet,Del
Crv~Corvus~Alp,Eps,Gam,Del,Bet,Eps
CVn~Canes Venatici~Alp,Bet
Cyg~Cygnus~Alp,Gam,Bet;Zet,Eps,Gam,Del,Iot-2,Kap
Del~Delphinus~Eps,Bet,Alp,Gam,Del,Bet
Dor~Dorado~Del,Bet,Zet,Alp,Gam;BSC:2102,Bet
Dra~Draco~Xi,Nu,Bet,Gam,Xi,Del,Eps,Tau,Chi,Psi,Zet,Eta,@The,Iot,Alp,Kap,Lam
Equ~Equuleus~Alp,Bet,Del,Gam,Alp
Eri~Eridanus~Lam,Bet,Ome,Mu,Nu,Omi-1,Gam,Pi,Del,Eps,Zet,Eta,@Tau-1,Tau-3,Tau-4,Tau-5,Tau-6,Tau-8,Tau-9,Ups-1,Ups-2,43,Ups-4,The,Iot,Kap,Phi,Chi,Alp
For~Fornax~Alp,Bet,Nu
Gem~Gemini~Xi,Gam,Nu,Mu,Eps,Tau,Rho,Alp,Sig,Bet,Kap,Del,Zet,Gam;Lam,Del;Eta,Mu
Gru~Grus~Alp,Bet,Iot,The;Zet,Eps,Bet,Del-2,Mu-1,Lam,Gam
Her~Hercules~Alp,Bet,Gam;Bet,Zet,Eta,Sig,Tau,Phi,Chi;Zet,Eps,Pi,Eta;Pi,Rho,The,Iot;Eps,Del,Lam,Mu,Xi,Omi
Hor~Horologium~Alp,BSC:868,Zet,Mu,Bet
Hya~Hydra~Pi,Gam,Bet,Xi,Nu,@Mu,Lam,Ups-1,Alp,Iot,The,Zet,Eta,Sig,Del,Eps,Zet
Hyi~Hydrus~Alp,Bet,Gam,Alp
Ind~Indus~Alp,The,Del;The,Bet
Lac~Lacerta~1,FK5:1583,6,2,5,4,Alp,Bet
Leo~Leo~Eps,Mu,Zet,Gam,Eta,Alp,The,Bet,Del,Gam
Lep~Lepus~Del,Gam,Bet,Alp,Zet,Eta;Eps,Bet;Alp,Mu
Lib~Libra~48,The,Gam,Bet,Sig,Ups,Tau;Sig,Alp-2,Bet
LMi~Leo Minor~46,Bet,21
Lup~Lupus~The,Eta,Gam,Del,Phi-1,Chi
Lyn~Lynx~Alp,38,FK5:339,31,21,15,2
Lyr~Lyra~Eps-2,Alp,Zet,Bet,Gam,Del-2,Zet
Men~Mensa~Alp,Gam,Eta,Bet
Mic~Microscopium~The-1,Eps,Gam,Alp
Mon~Monoceros~Zet,Alp,Del,18,8 Eps,13;Del,Bet,Gam
Mus~Musca~Bet,Alp,Gam;Del,Alp,Eps,Lam
Nor~Norma~Eps,Gam-2,Eta
Oct~Octans~Bet,Del,Nu,Bet
Oph~Ophiuchus~45,The,44,Xi,Eta,Bet,Alp,Kap,Del,Eps,Ups,Zet,Eta;70,67,Gam,Bet;Gam,Nu
Ori~Orion~Alp,Zet,Kap,Bet,Del,Gam,Lam,Alp,Mu,Xi,Nu,Chi-1;Xi,Chi-2;Pi-1,Pi-2,Pi-3,Gam;Pi-3,Pi-4,Pi-5,Pi-6
Pav~Pavo~Alp,Bet,Eps,Zet,Eta,Pi,Xi,Lam,Del,Bet,Gam
Peg~Pegasus~Bet,Alp (And),Gam,Alp,Bet,Eta,Iot,Kap;Bet,Mu,Lam,9,1;Alp,Xi,Zet,The,Eps
Per~Perseus~Omi,Zet,Xi,Eps,Del,Alp,Gam,Eta,Phi;Alp,Kap,Bet,Rho,16
Phe~Phoenix~Del,Gam,Bet,Alp,Eps,Eta,Zet,Bet
Pic~Pictor~Alp,Gam,Bet
PsA~Piscis Austrinus~Alp,Del,Gam,Bet,Mu,Iot,The,Lam,Eps,Alp
Psc~Pisces~Tau,Ups,Phi,Eta,Omi,Alp,Nu,Mu,Eps,@Del,Ome,Iot,Lam,Kap,Gam,The,Iot
Pup~Puppis~Zet,Sig,Tau,Nu,Pi,Xi,Rho,Zet
Pyx~Pyxis~Bet,Alp,Gam
Ret~Reticulum~Alp,Bet,Del,Eps,Alp
Scl~Sculptor~Alp,Iot,Del,Gam,Bet
Sco~Scorpius~Lam,Kap,Iot-1,The,Eta,Zet-2,Mu-1,Eps,Tau,Alp,Sig,Del,Bet,Nu;Del,Pi,Rho
Sct~Scutum~Bet,Alp,Gam;Alp,Zet
Ser~Serpens Caput~Mu,Eps,Alp,Del,Bet,Kap,Gam,Bet
Ser~Serpens Cauda~The,Eta,Omi,Xi,Nu
Sex~Sextans~Bet,Alp,Gam
Sge~Sagitta~Eta,Gam,Zet,Alp;Zet,Bet
Sgr~Sagittarius~Alp,Iot,The-1,62,52,Tau,Zet,Eps,Eta;Bet-2,Iot;Tau,Sig,Omi,Pi,Rho-1;Zet,Phi,Sig;Mu,Lam,Phi,Del,Gam-2,3;Lam,Del,Eps;Eps,Gam-2
Tau~Taurus~Bet,Tau,Eps,Del,Gam,Lam,Xi,Omi;Zet,Alp,The,Gam
Tel~Telescopium~Zet,Alp,Eps
TrA~Triangulum Australe~Alp,Bet,Gam,Alp
Tri~Triangulum~Alp,Bet,Gam,Alp
Tuc~Tucana~Del,Alp,Gam,Bet-1,Zet,Eps,Gam
UMa~Ursa Major~Eta,Zet,Eps,Del,Alp,Bet,Gam,Del;Kap,Iot,The,Ups,Omi,23,Alp;Ups,Bet;Gam,Chi,Nu,Xi;Chi,Psi,Mu,Lam
UMi~Ursa Minor~Alp,Del,Eps,Zet,Bet,Gam,Eta,Zet
Vel~Vela~Gam,Del,Kap,Phi,Mu,BSC:4167,FK5:1273,FK5:382,Psi,Lam,BSC:3477,FK5:324,Gam
Vir~Virgo~Mu,Iot,Kap,Alp,The,Gam,Del,Zet,Alp;109,Tau,Zet;Eps,Del;Gam,Eta,Bet
Vol~Volans~Alp,Bet,Eps,Zet,Gam,Del,Eps
Vul~Vulpecula~13,Alp,1`;

export const LINE_BREAK = -1;
export const LABEL_ANCHOR = -2;

export class StarCatalog {
  static readonly greekIndices =
    'Alp Bet Gam Del Eps Zet Eta The Iot Kap Lam Mu  Nu  Xi  Omi Pi  Rho Sig Tau Ups Phi Chi Psi Ome ';
  static readonly constellationCodes =
    'And Ant Aps Aql Aqr Ara Ari Aur Boo Cae Cam Cap Car Cas Cen Cep Cet Cha Cir CMa CMi Cnc Col Com ' +
    'CrA CrB Crt Cru Crv CVn Cyg Del Dor Dra Equ Eri For Gem Gru Her Hor Hya Hyi Ind Lac Leo Lep Lib ' +
    'LMi Lup Lyn Lyr Men Mic Mon Mus Nor Oct Oph Ori Pav Peg Per Phe Pic PsA Psc Pup Pyx Ret Scl Sco ' +
    'Sct Ser Sex Sge Sgr Tau Tel TrA Tri Tuc UMa UMi Vel Vir Vol Vul ';

  static readonly ECLIPTIC = 0x80000000; // Flag used in cache
  // Constant of aberration, converted to radians.
  static readonly kappa = 20.49552 / 648000 * PI;

  private starNames: {[name: string]: number} = {};
  private bscLookup: number[] = [];
  private fk5Lookup: number[] = [];
  private constellations: ConstellationInfo[] = [];
  private properlyInitialized = false;
  private cachedPositions: CacheEntry[] = [];
  private ecliptic = new Ecliptic();
  private sunCacheTime = -1E10;
  private sunLongitudeCache = -1;

  private stars: StarInfo[] = [];

  private static createCodedName(star: StarInfo): string {
    if (star.messierNum !== 0)
      return 'M' + star.messierNum;
    else if (star.ngcIcNum < 0)
      return 'IC ' + (-star.ngcIcNum);
    else if (star.ngcIcNum > 0)
      return 'NGC ' + star.ngcIcNum;

    let result = '';
    let pos;

    if (star.flamsteed > 0)
      result += star.flamsteed + ' ';

    if (star.bayerRank > 0) {
      pos = star.bayerRank * 4 - 4;
      result += StarCatalog.greekIndices.substr(pos, 3).trim() + ' ';
    }

    if (star.subIndex > 0)
      result = result.trim() + '-' + star.subIndex + ' ';

    if (star.constellation > 0) {
      pos = star.constellation * 4 - 4;
      result += StarCatalog.constellationCodes.substring(pos, pos + 3);
    }

    if (result === '') {
      if (star.fk5Num > 0)
        result = 'FK5 ' + star.fk5Num;
      else if (star.bscNum > 0)
        result = 'BSC ' + star.bscNum;
      else if (star.hipNum > 0)
        result = 'HC ' + star.hipNum;
      else
        return null;
    }

    return result;
  }

  constructor(private dataService: AstroDataService, readyCallback?: (initialized: boolean) => void) {
    this.dataService.getStars().then((data: ArrayBuffer) => {
      this.readStarData(data);

      if (readyCallback)
        readyCallback(this.properlyInitialized);
    });
  }

  private readStarData(data: ArrayBuffer): void {
    const reader = new ArrayBufferReader(data);
    let state = READING.FK5;
    let doDouble = false;
    let fk5Num = 0;
    const namesInUse: {[name: string]: boolean} = {};

    try {
      while (true) {
        const firstByte = reader.read(); // Can be marker, Flamsteed number, constellation number, or EOF.

        if (firstByte < 0) // EOF
          break;

        if (firstByte === MARKER.NEW_STATE) {
          ++state;
          continue;
        }
        else if (firstByte === MARKER.DBL_PREC) {
          doDouble = true;
          continue;
        }
        else if (firstByte === MARKER.SNG_PREC) {
          doDouble = false;
          continue;
        }
        else if (firstByte === MARKER.INC_FK5) {
          ++fk5Num;
          continue;
        }

        const star = <StarInfo> {};
        star.flamsteed = firstByte;

        star.bayerRank = reader.read();
        star.subIndex = reader.read();
        star.constellation = reader.read();

        if (doDouble) {
          star.RA = reader.readDouble();
          star.DE = reader.readDouble();
        }
        else {
          star.RA = reader.readFloat();
          star.DE = reader.readFloat();
        }

        star.pmRA = reader.readFloat();
        star.pmDE = reader.readFloat();

        const vmag = reader.read();

        if (vmag === 255)
          star.vmag = UNKNOWN_MAGNITUDE;
        else
          star.vmag = vmag / 10.0 - 2.0;

        if (state === READING.FK5) {
          star.fk5Num = ++fk5Num;
          star.bscNum = 0;
          star.hipNum = 0;
          star.ngcIcNum = 0;
          star.messierNum = 0;
        }
        else if (state === READING.BSC) {
          star.fk5Num = 0;
          star.bscNum = reader.readInt16();
          star.hipNum = 0;
          star.ngcIcNum = 0;
          star.messierNum = 0;
        }
        else if (state === READING.HIP) {
          star.fk5Num = 0;
          star.bscNum = 0;
          star.hipNum = reader.read() * 0x10000 + (reader.readInt16() & 0xFFFF);
          star.ngcIcNum = 0;
          star.messierNum = 0;
        }
        else {
          star.fk5Num = 0;
          star.bscNum = 0;
          star.hipNum = 0;
          star.ngcIcNum = reader.readInt16();
          star.messierNum = reader.read();
        }

        star.name = reader.readShortUtf8String();
        star.name = star.name || null;

        if (star.name != null) {
          if (!namesInUse[star.name]) {
            namesInUse[star.name] = true;
            star.duplicateName = false;
          }
          else
            star.duplicateName = true;
        }
        else
          star.duplicateName = false;

        star.codedName = StarCatalog.createCodedName(star);
        this.stars.push(star);
      }
    }
    catch (e) {
      console.error(e);
      this.properlyInitialized = false;
      return;
    }

    this.stars.sort((a, b) => {
      // The most important thing is sorting stars by magnitude, dimmest (highest vmag) first.
      // The rest of the comparison, if vmags match, is to impose a consistent sort order.
      if (a.vmag > b.vmag)
        return -1;
      else if (a.vmag < b.vmag)
        return 1;
      else if (a.fk5Num !== 0 || b.fk5Num !== 0)
        return sign(a.fk5Num - b.fk5Num);
      else if (a.bscNum !== 0 || b.bscNum !== 0)
        return sign(a.bscNum - b.bscNum);
      else if (a.hipNum !== 0 || b.hipNum !== 0)
        return sign(a.hipNum - b.hipNum);
      else if (a.ngcIcNum !== 0 || b.ngcIcNum !== 0)
        return sign(a.ngcIcNum - b.ngcIcNum);

      return sign(a.messierNum - b.messierNum);
    });

    this.cachedPositions = [];
    this.cachedPositions.length = this.stars.length;

    // Create look-up tables for star indices.
    for (let i = 0; i < this.stars.length; ++i) {
      this.cachedPositions[i] = <CacheEntry> {};

      const star = this.stars[i];

      if (star.fk5Num > 0)
        this.fk5Lookup[star.fk5Num] = i;

      if (star.bscNum > 0)
        this.bscLookup[star.bscNum] = i;

      if (star.name)
        this.starNames[star.name] = i;

      if (star.codedName) {
        this.starNames[star.codedName] = i;

        // For coded names such as 47 Lam Peg, we'll make an additional
        // shortened look-up entry, i.e. Lam Peg.
        const match = /^(\d+\s*)(.+)$/.exec(star.codedName);

        if (match && !this.starNames[match[2]])
          this.starNames[match[2]] = i;
      }
    }

    // Parse constellation data.
    const lines = CONSTELLATION_LINES.split('\n');

    for (let line of lines) {
      line = line.trim();

      if (!line)
        continue;

      const parts = line.split('~');

      if (parts.length !== 3)
        continue;

      const constCode = parts[0];
      const constName = parts[1];
      const paths = parts[2].split(';');
      const starList: number[] = [];

      for (const path of paths) {
        if (starList.length > 0)
          starList.push(LINE_BREAK);

        const starIndices = path.split(',');

        for (let codedIndex of starIndices) {
          if (codedIndex.startsWith('@')) {
            starList.push(LABEL_ANCHOR);
            codedIndex = codedIndex.substring(1);
          }

          if (codedIndex.startsWith('FK5:')) {
            fk5Num = Number(codedIndex.substring(4));

            if (this.fk5Lookup[fk5Num] > 0)
              starList.push(this.fk5Lookup[fk5Num]);
            else
              console.error(codedIndex + ' not found');
          }
          else if (codedIndex.startsWith('BSC:')) {
            const bscNum = Number(codedIndex.substring(4));

            if (this.bscLookup[bscNum])
              starList.push(this.bscLookup[bscNum]);
            else
              console.error(codedIndex + ' not found');
          }
          else {
            let pos: number;
            let constCode2;
            let starNum;

            if ((pos = codedIndex.lastIndexOf('(')) >= 0) {
              constCode2 = codedIndex.substring(pos + 1, codedIndex.length - 1);
              codedIndex = codedIndex.substring(0, pos).trim();
            }
            else
              constCode2 = constCode;

            const codedName = codedIndex + ' ' + constCode2;

            // If a first match is not found on, say, Gam And,
            // try Gam-1 And.
            if (!(starNum = this.starNames[codedName])) {
              const codedNameAlt = codedIndex + '-1 ' + constCode2;

              if (!(starNum = this.starNames[codedNameAlt]))
                console.error(codedName + ' not found');
            }

            if (starNum)
              starList.push(starNum);
          }
        }
      }

      this.constellations.push({name: constName, code: constCode, starList: starList});
    }

    this.properlyInitialized = true;
  }

  public isProperlyInitialized(): boolean {
    return this.properlyInitialized;
  }

  public getStarCount(): number {
    return (this.stars ? this.stars.length : 0);
  }

  public getName(starIndex: number, skipDuplicates = false): string {
    if (starIndex < 0 || starIndex >= this.stars.length || (skipDuplicates && this.stars[starIndex].duplicateName))
      return null;

    return this.stars[starIndex].name;
  }

  public getCodedName(starIndex: number): string {
    if (starIndex < 0 || starIndex >= this.stars.length)
      return null;

    return this.stars[starIndex].codedName;
  }

  public getExpandedName(starIndex: number): string {
    let name, fullName;
    const codedName = this.getCodedName(starIndex);

    if (this.isDeepSkyObject(starIndex))
      name = codedName;

    fullName = this.getName(starIndex, true);

    if (fullName) {
      if (!name) {
        name = fullName;

        if (codedName)
          name += ' (' + codedName + ')';
      }
      else
        name += ' - ' + fullName;
    }

    return name;
  }

  public getMagnitude(starIndex: number): number {
    if (starIndex < 0 || starIndex >= this.stars.length)
      return -1.0E6;

    return this.stars[starIndex].vmag;
  }

  public getFK5Number(starIndex: number): number {
    if (starIndex < 0 || starIndex >= this.stars.length)
      return 0;

    return this.stars[starIndex].fk5Num;
  }

  public getBSCNumber(starIndex: number): number {
    if (starIndex < 0 || starIndex >= this.stars.length)
      return 0;

    return this.stars[starIndex].bscNum;
  }

  public isDeepSkyObject(starIndex: number): boolean {
    if (starIndex < 0 || starIndex >= this.stars.length)
      return false;

    const star = this.stars[starIndex];

    return (star.messierNum !== 0 || star.ngcIcNum !== 0);
  }

  public getMessierNumber(starIndex: number): number {
    if (starIndex < 0 || starIndex >= this.stars.length)
      return 0;

    return this.stars[starIndex].messierNum;
  }

  public getNGCNumber(starIndex: number): number {
    if (starIndex < 0 || starIndex >= this.stars.length || this.stars[starIndex].ngcIcNum <= 0)
      return 0;

    return this.stars[starIndex].ngcIcNum;
  }

  public getICNumber(starIndex: number): number {
    if (starIndex < 0 || starIndex >= this.stars.length || this.stars[starIndex].ngcIcNum >= 0)
      return 0;

    return -this.stars[starIndex].ngcIcNum;
  }

  public getBayerRank(starIndex: number): number {
    if (starIndex < 0 || starIndex >= this.stars.length)
      return 0;

    return this.stars[starIndex].bayerRank;
  }

  public getConstellationOfStar(starIndex: number): number {
    if (starIndex < 0 || starIndex >= this.stars.length)
      return 0;

    return this.stars[starIndex].constellation;
  }

  public getConstellationCount(): number {
    return this.constellations.length;
  }

  public getConstellationName(constellationIndex: number): string {
    if (constellationIndex < 0 || constellationIndex >= this.constellations.length)
      return null;

    return this.constellations[constellationIndex].name;
  }

  public getConstellationCode(constellationIndex: number): string {
    if (constellationIndex < 0 || constellationIndex >= this.constellations.length)
      return null;

    return this.constellations[constellationIndex].code;
  }

  public getConstellationDrawingStars(constellationIndex: number): number[] {
    if (constellationIndex < 0 || constellationIndex >= this.constellations.length)
      return null;

    return this.constellations[constellationIndex].starList;
  }

  // Note: The calculation for aberration used here can misbehave for coordinates very close
  // to either pole, but no stars in the star catalogs that I'm using get close enough
  // to cause a problem over the time period of years -5999 to 9999.
  //
  public getEquatorialPosition(starIndex: number, time_JDE: number, cacheTolerance = 0, flags = 0): SphericalPosition {
    if (starIndex < 0 || starIndex >= this.stars.length)
      return null;

    if (this.cachedPositions[starIndex].pos &&
        this.cachedPositions[starIndex].flags === flags &&
        abs(this.cachedPositions[starIndex].time - time_JDE) <= cacheTolerance)
      return this.cachedPositions[starIndex].pos;

    const star = this.stars[starIndex];
    const T = (time_JDE - JD_J2000) / 36525.0;
    let pos = new SphericalPosition(star.RA + star.pmRA * T / 3600.0,
                                    star.DE + star.pmDE * T / 3600.0, Unit.HOURS, Unit.DEGREES);

    if ((flags & NO_PRECESSION) === 0)
      pos = Ecliptic.precessEquatorial(pos, time_JDE);

    if ((flags & NUTATION) !== 0)
      pos = this.ecliptic.nutateEquatorialPosition(pos, time_JDE);

    if ((flags & ABERRATION) !== 0) {
      // Low-precision formulae for the Sun's longitude and the obliquity of the
      // ecliptic are quite enough here, given that the greatest effect of stellar
      // aberration is only 20.5".

      const T2 = T * T;
      const e = 0.016708634 - 0.000042037 * T - 0.0000001267 * T2;
      const pi = to_radian(102.93735 + 1.71946 * T + 0.00046 * T2);
      const e0 = to_radian(OBLIQUITY_J2000 - (46.8150 * T - 0.00059 * T2 + 0.001813 * T2 * T) / 3600.0);

      if (time_JDE !== this.sunCacheTime) {
        const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T2;
        const M = 357.52911 + 35999.05029 * T - 0.0001537 * T2;
        const C = (1.914602 - 0.004817 * T - 0.000014 * T2) * sin_deg(M)
                  + (0.019993 - 0.000101 * T) * sin_deg(2.0 * M)
                  + 0.000289 * sin_deg(3.0 * M);
        this.sunLongitudeCache = to_radian(mod(L0 + C, 360.0));
      }

      const LS   = this.sunLongitudeCache;
      const RA   = pos.rightAscension.radians;
      const dec  = pos.declination.radians;
      const cosd = cos(dec);
      let   dRA  = 0.0;

      if (cosd !== 0)
        dRA = -StarCatalog.kappa * ((cos(RA) * cos(LS) * cos(e0) + sin(RA) * sin(LS))
          - e * (cos(RA) * cos(pi) * cos(e0) + sin(RA) * sin(pi))) / cosd;

      const dDec = -StarCatalog.kappa *
                      (cos(LS) * cos(e0) * (tan(e0) * cosd - sin(RA) * sin(dec))
                       + cos(RA) * sin(dec) * sin(LS)
                       - e * (cos(pi) * cos(e0) * (tan(e0) * cosd - sin(RA) * sin(dec))
                       + cos(RA) * sin(dec) * sin(pi)));

      pos = new SphericalPosition(RA + dRA, dec + dDec);
    }

    this.cachedPositions[starIndex].pos = pos;
    this.cachedPositions[starIndex].flags = flags;
    this.cachedPositions[starIndex].time = time_JDE;

    return pos;
  }

  public getEclipticPosition(starIndex: number, time_JDE: number, cacheTolerance = 0, flags = 0): SphericalPosition {
    if (starIndex < 0 || starIndex >= this.stars.length)
      return null;

    flags |= StarCatalog.ECLIPTIC;

    if (this.cachedPositions[starIndex].pos !== null &&
        this.cachedPositions[starIndex].flags === flags &&
        abs(this.cachedPositions[starIndex].time - time_JDE) <= cacheTolerance)
      return this.cachedPositions[starIndex].pos;

    // Don't compute nutation twice -- it's much more efficient to apply
    // nutation to ecliptic coordinates.
    const eqPos = this.getEquatorialPosition(starIndex, time_JDE, flags & ~NUTATION);

    let nutationMode: NMode;

    if ((flags & NUTATION) !== 0)
      nutationMode = NMode.NUTATED;
    else
      nutationMode = NMode.J2000;

    let pos = this.ecliptic.equatorialToEcliptic(eqPos, time_JDE, nutationMode);

    pos = this.ecliptic.nutateEclipticPosition(pos, time_JDE, nutationMode);

    this.cachedPositions[starIndex].pos = pos;
    this.cachedPositions[starIndex].flags = flags;
    this.cachedPositions[starIndex].time = time_JDE;

    return pos;
  }

  // Note: cacheTolerance applies to the equatorial position of a star. Horizontal coordinates
  //    themselves are not cached.
  //
  public getHorizontalPosition(starIndex: number, time_JDU: number, observer: ISkyObserver,
      cacheTolerance: number, flags = 0): SphericalPosition {
    if (starIndex < 0 || starIndex >= this.stars.length)
      return null;

    flags &= ~NUTATION;

    const pos = this.getEquatorialPosition(starIndex, UT_to_TDB(time_JDU), cacheTolerance, flags);

    return observer.equatorialToHorizontal(pos, time_JDU, flags);
  }
}
