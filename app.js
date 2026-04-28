/* =====================================================================
   Skyward · live flight tracker (for Norma 💛)
   Live data:  adsb.lol      — https://api.adsb.lol/v2/callsign/{cs}
   Routes:     hexdb.io      — https://hexdb.io/api/v1/route/icao/{cs}
   Map:        Leaflet + CartoDB dark tiles
   ===================================================================== */

'use strict';

/* ─────────────────────────────────────────
   Config
   ───────────────────────────────────────── */
const CONFIG = {
  adsbBase:   'https://api.adsb.lol/v2',
  adsbdbBase: 'https://api.adsbdb.com/v0',  // route lookups (origin + destination with coords)
  hexdbBase:  'https://hexdb.io/api/v1',    // fallback route lookup
  weatherBase:'https://api.open-meteo.com/v1/forecast',  // weather at destination — free, no key
  // Public CORS proxies. We try each in order if direct browser fetch fails.
  // Ordered by reliability for POST requests — the route lookup uses POST and
  // some proxies silently strip POST bodies. allorigins handles POST cleanly,
  // codetabs is solid, corsproxy.io is fastest for GET but can mangle POST.
  corsProxies: [
    url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
    url => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
    url => `https://thingproxy.freeboard.io/fetch/${url}`,
  ],
  refreshMs:        30_000,                // re-poll live position every 30s
  weatherRefreshMs: 10 * 60_000,           // weather every 10 min
  storageKey:  'skyward.v2',
  partnerName: 'You',
};

/* ─────────────────────────────────────────
   IATA → ICAO airline codes
   ───────────────────────────────────────── */
const AIRLINES = {
  AA:'AAL',AC:'ACA',AF:'AFR',AI:'AIC',AM:'AMX',AR:'ARG',AS:'ASA',AY:'FIN',AZ:'ITY',
  BA:'BAW',B6:'JBU',BR:'EVA',BT:'BTI',BY:'TOM',
  CA:'CCA',CI:'CAL',CM:'CMP',CX:'CPA',CZ:'CSN',
  DL:'DAL',DY:'NAX',
  EI:'EIN',EK:'UAE',ET:'ETH',EY:'ETD',
  F9:'FFT',FR:'RYR',
  GA:'GIA',G3:'GLO',G4:'AAY',
  HA:'HAL',HU:'CHH',HX:'CRK',
  IB:'IBE','6E':'IGO',
  JL:'JAL',JQ:'JST','3K':'JSA',
  KC:'KZR',KE:'KAL',KL:'KLM',KQ:'KQA',
  LA:'LAN',LH:'DLH',LO:'LOT',LX:'SWR',LY:'ELY',
  ME:'MEA',MH:'MAS',MS:'MSR',MU:'CES',
  NH:'ANA',NK:'NKS',NZ:'ANZ',
  OS:'AUA',OZ:'AAR',OK:'CSA',
  PK:'PIA',PR:'PAL','PS':'AUI',
  QF:'QFA',QR:'QTR',
  RJ:'RJA',RO:'ROT',
  SA:'SAA',SK:'SAS',SN:'BEL',SQ:'SIA',SU:'AFL',SV:'SVA',S7:'SBI',SG:'SEJ',
  TG:'THA',TK:'THY',TP:'TAP',TR:'SCO',
  U2:'EZY',UA:'UAL',UL:'ALK','UK':'VTI',
  VN:'HVN',VS:'VIR',VY:'VLG',
  W6:'WZZ',WN:'SWA',WS:'WJA',WF:'WIF',
  AV:'AVA',A3:'AEE',
};

/* ─────────────────────────────────────────
   Major-airport database (ICAO → details)
   ───────────────────────────────────────── */
const AIRPORTS = {
  // ─── United States ───
  KJFK:{iata:'JFK',name:'John F. Kennedy Intl',city:'New York',country:'US',lat:40.6413,lon:-73.7781},
  KLGA:{iata:'LGA',name:'LaGuardia',city:'New York',country:'US',lat:40.7769,lon:-73.8740},
  KEWR:{iata:'EWR',name:'Newark Liberty',city:'Newark',country:'US',lat:40.6925,lon:-74.1687},
  KBOS:{iata:'BOS',name:'Logan Intl',city:'Boston',country:'US',lat:42.3656,lon:-71.0096},
  KORD:{iata:'ORD',name:"O'Hare Intl",city:'Chicago',country:'US',lat:41.9742,lon:-87.9073},
  KMDW:{iata:'MDW',name:'Midway Intl',city:'Chicago',country:'US',lat:41.7868,lon:-87.7522},
  KATL:{iata:'ATL',name:'Hartsfield-Jackson',city:'Atlanta',country:'US',lat:33.6407,lon:-84.4277},
  KDFW:{iata:'DFW',name:'Dallas/Fort Worth',city:'Dallas',country:'US',lat:32.8998,lon:-97.0403},
  KIAH:{iata:'IAH',name:'George Bush Intl',city:'Houston',country:'US',lat:29.9844,lon:-95.3414},
  KMIA:{iata:'MIA',name:'Miami Intl',city:'Miami',country:'US',lat:25.7959,lon:-80.2870},
  KFLL:{iata:'FLL',name:'Fort Lauderdale',city:'Fort Lauderdale',country:'US',lat:26.0742,lon:-80.1506},
  KMCO:{iata:'MCO',name:'Orlando Intl',city:'Orlando',country:'US',lat:28.4312,lon:-81.3081},
  KTPA:{iata:'TPA',name:'Tampa Intl',city:'Tampa',country:'US',lat:27.9755,lon:-82.5332},
  KIAD:{iata:'IAD',name:'Washington Dulles',city:'Washington DC',country:'US',lat:38.9531,lon:-77.4565},
  KDCA:{iata:'DCA',name:'Reagan National',city:'Washington DC',country:'US',lat:38.8512,lon:-77.0402},
  KBWI:{iata:'BWI',name:'Baltimore/Washington',city:'Baltimore',country:'US',lat:39.1754,lon:-76.6683},
  KPHL:{iata:'PHL',name:'Philadelphia Intl',city:'Philadelphia',country:'US',lat:39.8744,lon:-75.2424},
  KCLT:{iata:'CLT',name:'Charlotte Douglas',city:'Charlotte',country:'US',lat:35.2140,lon:-80.9431},
  KLAX:{iata:'LAX',name:'Los Angeles Intl',city:'Los Angeles',country:'US',lat:33.9416,lon:-118.4085},
  KSFO:{iata:'SFO',name:'San Francisco Intl',city:'San Francisco',country:'US',lat:37.6213,lon:-122.3790},
  KSEA:{iata:'SEA',name:'Seattle-Tacoma',city:'Seattle',country:'US',lat:47.4502,lon:-122.3088},
  KSAN:{iata:'SAN',name:'San Diego Intl',city:'San Diego',country:'US',lat:32.7338,lon:-117.1933},
  KLAS:{iata:'LAS',name:'Harry Reid Intl',city:'Las Vegas',country:'US',lat:36.0840,lon:-115.1537},
  KPHX:{iata:'PHX',name:'Sky Harbor Intl',city:'Phoenix',country:'US',lat:33.4373,lon:-112.0078},
  KDEN:{iata:'DEN',name:'Denver Intl',city:'Denver',country:'US',lat:39.8561,lon:-104.6737},
  KDTW:{iata:'DTW',name:'Detroit Metro',city:'Detroit',country:'US',lat:42.2162,lon:-83.3554},
  KMSP:{iata:'MSP',name:'Minneapolis-St Paul',city:'Minneapolis',country:'US',lat:44.8848,lon:-93.2223},
  KSLC:{iata:'SLC',name:'Salt Lake City Intl',city:'Salt Lake City',country:'US',lat:40.7899,lon:-111.9791},
  KPDX:{iata:'PDX',name:'Portland Intl',city:'Portland',country:'US',lat:45.5887,lon:-122.5975},
  KAUS:{iata:'AUS',name:'Austin-Bergstrom',city:'Austin',country:'US',lat:30.1945,lon:-97.6699},
  KBNA:{iata:'BNA',name:'Nashville Intl',city:'Nashville',country:'US',lat:36.1245,lon:-86.6782},
  KHNL:{iata:'HNL',name:'Daniel K. Inouye',city:'Honolulu',country:'US',lat:21.3187,lon:-157.9224},
  KOAK:{iata:'OAK',name:'Oakland Intl',city:'Oakland',country:'US',lat:37.7213,lon:-122.2208},
  KSJC:{iata:'SJC',name:'Norman Y. Mineta',city:'San Jose',country:'US',lat:37.3639,lon:-121.9289},
  KANC:{iata:'ANC',name:'Ted Stevens Intl',city:'Anchorage',country:'US',lat:61.1744,lon:-149.9961},

  // ─── Canada ───
  CYYZ:{iata:'YYZ',name:'Toronto Pearson',city:'Toronto',country:'CA',lat:43.6777,lon:-79.6248},
  CYUL:{iata:'YUL',name:'Montréal-Trudeau',city:'Montréal',country:'CA',lat:45.4706,lon:-73.7408},
  CYVR:{iata:'YVR',name:'Vancouver Intl',city:'Vancouver',country:'CA',lat:49.1939,lon:-123.1844},
  CYYC:{iata:'YYC',name:'Calgary Intl',city:'Calgary',country:'CA',lat:51.1215,lon:-114.0076},
  CYEG:{iata:'YEG',name:'Edmonton Intl',city:'Edmonton',country:'CA',lat:53.3097,lon:-113.5801},
  CYOW:{iata:'YOW',name:'Ottawa Macdonald-Cartier',city:'Ottawa',country:'CA',lat:45.3225,lon:-75.6692},
  CYHZ:{iata:'YHZ',name:'Halifax Stanfield',city:'Halifax',country:'CA',lat:44.8808,lon:-63.5086},

  // ─── Mexico / Central America / Caribbean ───
  MMMX:{iata:'MEX',name:'Benito Juárez',city:'Mexico City',country:'MX',lat:19.4361,lon:-99.0719},
  MMUN:{iata:'CUN',name:'Cancún Intl',city:'Cancún',country:'MX',lat:21.0365,lon:-86.8770},
  MMGL:{iata:'GDL',name:'Guadalajara Intl',city:'Guadalajara',country:'MX',lat:20.5217,lon:-103.3110},
  MMMY:{iata:'MTY',name:'Monterrey Intl',city:'Monterrey',country:'MX',lat:25.7785,lon:-100.1067},
  MROC:{iata:'SJO',name:'Juan Santamaría',city:'San José',country:'CR',lat:9.9939,lon:-84.2088},
  MPTO:{iata:'PTY',name:'Tocumen Intl',city:'Panama City',country:'PA',lat:9.0714,lon:-79.3835},
  MDPC:{iata:'PUJ',name:'Punta Cana Intl',city:'Punta Cana',country:'DO',lat:18.5674,lon:-68.3634},
  MDSD:{iata:'SDQ',name:'Las Américas',city:'Santo Domingo',country:'DO',lat:18.4297,lon:-69.6689},
  TJSJ:{iata:'SJU',name:'Luis Muñoz Marín',city:'San Juan',country:'PR',lat:18.4394,lon:-66.0018},
  MKJP:{iata:'KIN',name:'Norman Manley',city:'Kingston',country:'JM',lat:17.9357,lon:-76.7875},
  MKJS:{iata:'MBJ',name:'Sangster Intl',city:'Montego Bay',country:'JM',lat:18.5037,lon:-77.9134},

  // ─── South America ───
  SBGR:{iata:'GRU',name:'São Paulo–Guarulhos',city:'São Paulo',country:'BR',lat:-23.4356,lon:-46.4731},
  SBSP:{iata:'CGH',name:'Congonhas',city:'São Paulo',country:'BR',lat:-23.6261,lon:-46.6564},
  SBGL:{iata:'GIG',name:'Galeão',city:'Rio de Janeiro',country:'BR',lat:-22.8089,lon:-43.2436},
  SBRJ:{iata:'SDU',name:'Santos Dumont',city:'Rio de Janeiro',country:'BR',lat:-22.9105,lon:-43.1633},
  SBBR:{iata:'BSB',name:'Brasília Intl',city:'Brasília',country:'BR',lat:-15.8711,lon:-47.9186},
  SAEZ:{iata:'EZE',name:'Ministro Pistarini',city:'Buenos Aires',country:'AR',lat:-34.8222,lon:-58.5358},
  SABE:{iata:'AEP',name:'Aeroparque',city:'Buenos Aires',country:'AR',lat:-34.5592,lon:-58.4156},
  SCEL:{iata:'SCL',name:'Arturo Merino Benítez',city:'Santiago',country:'CL',lat:-33.3928,lon:-70.7858},
  SPJC:{iata:'LIM',name:'Jorge Chávez',city:'Lima',country:'PE',lat:-12.0219,lon:-77.1143},
  SKBO:{iata:'BOG',name:'El Dorado',city:'Bogotá',country:'CO',lat:4.7016,lon:-74.1469},
  SEQM:{iata:'UIO',name:'Mariscal Sucre',city:'Quito',country:'EC',lat:-0.1293,lon:-78.3575},
  SUMU:{iata:'MVD',name:'Carrasco Intl',city:'Montevideo',country:'UY',lat:-34.8384,lon:-56.0308},

  // ─── United Kingdom & Ireland ───
  EGLL:{iata:'LHR',name:'Heathrow',city:'London',country:'UK',lat:51.4700,lon:-0.4543},
  EGKK:{iata:'LGW',name:'Gatwick',city:'London',country:'UK',lat:51.1537,lon:-0.1821},
  EGSS:{iata:'STN',name:'Stansted',city:'London',country:'UK',lat:51.8860,lon:0.2389},
  EGGW:{iata:'LTN',name:'Luton',city:'London',country:'UK',lat:51.8747,lon:-0.3683},
  EGLC:{iata:'LCY',name:'London City',city:'London',country:'UK',lat:51.5053,lon:0.0553},
  EGCC:{iata:'MAN',name:'Manchester',city:'Manchester',country:'UK',lat:53.3537,lon:-2.2750},
  EGPF:{iata:'GLA',name:'Glasgow',city:'Glasgow',country:'UK',lat:55.8717,lon:-4.4332},
  EGPH:{iata:'EDI',name:'Edinburgh',city:'Edinburgh',country:'UK',lat:55.9500,lon:-3.3725},
  EGBB:{iata:'BHX',name:'Birmingham',city:'Birmingham',country:'UK',lat:52.4539,lon:-1.7480},
  EIDW:{iata:'DUB',name:'Dublin',city:'Dublin',country:'IE',lat:53.4213,lon:-6.2701},
  EICK:{iata:'ORK',name:'Cork',city:'Cork',country:'IE',lat:51.8413,lon:-8.4911},

  // ─── Western/Central Europe ───
  LFPG:{iata:'CDG',name:'Charles de Gaulle',city:'Paris',country:'FR',lat:49.0097,lon:2.5479},
  LFPO:{iata:'ORY',name:'Orly',city:'Paris',country:'FR',lat:48.7233,lon:2.3794},
  LFMN:{iata:'NCE',name:"Côte d'Azur",city:'Nice',country:'FR',lat:43.6584,lon:7.2159},
  LFML:{iata:'MRS',name:'Marseille Provence',city:'Marseille',country:'FR',lat:43.4393,lon:5.2214},
  LFLL:{iata:'LYS',name:'Lyon-Saint Exupéry',city:'Lyon',country:'FR',lat:45.7256,lon:5.0811},
  LFBO:{iata:'TLS',name:'Toulouse-Blagnac',city:'Toulouse',country:'FR',lat:43.6293,lon:1.3638},
  EDDF:{iata:'FRA',name:'Frankfurt am Main',city:'Frankfurt',country:'DE',lat:50.0379,lon:8.5622},
  EDDM:{iata:'MUC',name:'Munich',city:'Munich',country:'DE',lat:48.3537,lon:11.7750},
  EDDB:{iata:'BER',name:'Berlin Brandenburg',city:'Berlin',country:'DE',lat:52.3667,lon:13.5033},
  EDDH:{iata:'HAM',name:'Hamburg',city:'Hamburg',country:'DE',lat:53.6304,lon:9.9882},
  EDDL:{iata:'DUS',name:'Düsseldorf',city:'Düsseldorf',country:'DE',lat:51.2895,lon:6.7668},
  EDDS:{iata:'STR',name:'Stuttgart',city:'Stuttgart',country:'DE',lat:48.6899,lon:9.2220},
  EDDK:{iata:'CGN',name:'Cologne Bonn',city:'Cologne',country:'DE',lat:50.8659,lon:7.1427},
  EHAM:{iata:'AMS',name:'Schiphol',city:'Amsterdam',country:'NL',lat:52.3105,lon:4.7683},
  EBBR:{iata:'BRU',name:'Brussels',city:'Brussels',country:'BE',lat:50.9014,lon:4.4844},
  LSZH:{iata:'ZRH',name:'Zürich',city:'Zürich',country:'CH',lat:47.4647,lon:8.5492},
  LSGG:{iata:'GVA',name:'Geneva',city:'Geneva',country:'CH',lat:46.2381,lon:6.1090},
  LOWW:{iata:'VIE',name:'Vienna Intl',city:'Vienna',country:'AT',lat:48.1102,lon:16.5697},
  LIRF:{iata:'FCO',name:'Fiumicino',city:'Rome',country:'IT',lat:41.8003,lon:12.2389},
  LIMC:{iata:'MXP',name:'Malpensa',city:'Milan',country:'IT',lat:45.6306,lon:8.7281},
  LIME:{iata:'BGY',name:'Bergamo Orio al Serio',city:'Milan',country:'IT',lat:45.6739,lon:9.7042},
  LIPZ:{iata:'VCE',name:'Marco Polo',city:'Venice',country:'IT',lat:45.5053,lon:12.3519},
  LIRN:{iata:'NAP',name:'Capodichino',city:'Naples',country:'IT',lat:40.8860,lon:14.2908},
  LEMD:{iata:'MAD',name:'Madrid-Barajas',city:'Madrid',country:'ES',lat:40.4983,lon:-3.5676},
  LEBL:{iata:'BCN',name:'Barcelona-El Prat',city:'Barcelona',country:'ES',lat:41.2974,lon:2.0833},
  LEPA:{iata:'PMI',name:'Palma de Mallorca',city:'Palma',country:'ES',lat:39.5517,lon:2.7388},
  LEMG:{iata:'AGP',name:'Málaga-Costa del Sol',city:'Málaga',country:'ES',lat:36.6749,lon:-4.4991},
  LEIB:{iata:'IBZ',name:'Ibiza',city:'Ibiza',country:'ES',lat:38.8729,lon:1.3731},
  LPPT:{iata:'LIS',name:'Humberto Delgado',city:'Lisbon',country:'PT',lat:38.7813,lon:-9.1359},
  LPPR:{iata:'OPO',name:'Francisco Sá Carneiro',city:'Porto',country:'PT',lat:41.2481,lon:-8.6814},
  LPFR:{iata:'FAO',name:'Faro',city:'Faro',country:'PT',lat:37.0144,lon:-7.9659},
  LGAV:{iata:'ATH',name:'Eleftherios Venizelos',city:'Athens',country:'GR',lat:37.9364,lon:23.9445},
  LGTS:{iata:'SKG',name:'Macedonia',city:'Thessaloniki',country:'GR',lat:40.5197,lon:22.9709},
  LGIR:{iata:'HER',name:'Heraklion',city:'Heraklion',country:'GR',lat:35.3397,lon:25.1803},
  LGSR:{iata:'JTR',name:'Santorini',city:'Santorini',country:'GR',lat:36.3992,lon:25.4793},
  LTFM:{iata:'IST',name:'Istanbul',city:'Istanbul',country:'TR',lat:41.2753,lon:28.7519},
  LTAI:{iata:'AYT',name:'Antalya',city:'Antalya',country:'TR',lat:36.8987,lon:30.8005},

  // ─── Northern / Eastern Europe ───
  EKCH:{iata:'CPH',name:'Copenhagen',city:'Copenhagen',country:'DK',lat:55.6180,lon:12.6508},
  ESSA:{iata:'ARN',name:'Stockholm-Arlanda',city:'Stockholm',country:'SE',lat:59.6519,lon:17.9186},
  ESGG:{iata:'GOT',name:'Göteborg-Landvetter',city:'Gothenburg',country:'SE',lat:57.6628,lon:12.2798},
  ENGM:{iata:'OSL',name:'Oslo Gardermoen',city:'Oslo',country:'NO',lat:60.1939,lon:11.1004},
  ENBR:{iata:'BGO',name:'Bergen Flesland',city:'Bergen',country:'NO',lat:60.2934,lon:5.2181},
  EFHK:{iata:'HEL',name:'Helsinki-Vantaa',city:'Helsinki',country:'FI',lat:60.3172,lon:24.9633},
  BIKF:{iata:'KEF',name:'Keflavík',city:'Reykjavík',country:'IS',lat:63.9850,lon:-22.6056},
  EPWA:{iata:'WAW',name:'Chopin',city:'Warsaw',country:'PL',lat:52.1657,lon:20.9671},
  EPKK:{iata:'KRK',name:'John Paul II',city:'Kraków',country:'PL',lat:50.0777,lon:19.7848},
  LKPR:{iata:'PRG',name:'Václav Havel',city:'Prague',country:'CZ',lat:50.1008,lon:14.2632},
  LZIB:{iata:'BTS',name:'M.R. Štefánik',city:'Bratislava',country:'SK',lat:48.1702,lon:17.2127},
  LHBP:{iata:'BUD',name:'Budapest Ferenc Liszt',city:'Budapest',country:'HU',lat:47.4369,lon:19.2556},
  LROP:{iata:'OTP',name:'Henri Coandă',city:'Bucharest',country:'RO',lat:44.5722,lon:26.1022},
  LBSF:{iata:'SOF',name:'Sofia',city:'Sofia',country:'BG',lat:42.6967,lon:23.4114},
  LDZA:{iata:'ZAG',name:'Franjo Tuđman',city:'Zagreb',country:'HR',lat:45.7429,lon:16.0688},
  LMML:{iata:'MLA',name:'Malta Intl',city:'Luqa',country:'MT',lat:35.8575,lon:14.4775},
  UUEE:{iata:'SVO',name:'Sheremetyevo',city:'Moscow',country:'RU',lat:55.9726,lon:37.4146},
  UUDD:{iata:'DME',name:'Domodedovo',city:'Moscow',country:'RU',lat:55.4088,lon:37.9063},
  ULLI:{iata:'LED',name:'Pulkovo',city:'St. Petersburg',country:'RU',lat:59.8003,lon:30.2625},

  // ─── Middle East ───
  OMDB:{iata:'DXB',name:'Dubai Intl',city:'Dubai',country:'AE',lat:25.2532,lon:55.3657},
  OMSJ:{iata:'SHJ',name:'Sharjah Intl',city:'Sharjah',country:'AE',lat:25.3286,lon:55.5172},
  OMAA:{iata:'AUH',name:'Abu Dhabi Intl',city:'Abu Dhabi',country:'AE',lat:24.4330,lon:54.6511},
  OTHH:{iata:'DOH',name:'Hamad Intl',city:'Doha',country:'QA',lat:25.2731,lon:51.6080},
  OERK:{iata:'RUH',name:'King Khalid',city:'Riyadh',country:'SA',lat:24.9576,lon:46.6988},
  OEJN:{iata:'JED',name:'King Abdulaziz',city:'Jeddah',country:'SA',lat:21.6796,lon:39.1565},
  OBBI:{iata:'BAH',name:'Bahrain Intl',city:'Manama',country:'BH',lat:26.2708,lon:50.6336},
  OOMS:{iata:'MCT',name:'Muscat Intl',city:'Muscat',country:'OM',lat:23.5933,lon:58.2844},
  OKBK:{iata:'KWI',name:'Kuwait Intl',city:'Kuwait City',country:'KW',lat:29.2266,lon:47.9689},
  OJAI:{iata:'AMM',name:'Queen Alia Intl',city:'Amman',country:'JO',lat:31.7226,lon:35.9933},
  LLBG:{iata:'TLV',name:'Ben Gurion',city:'Tel Aviv',country:'IL',lat:32.0114,lon:34.8867},

  // ─── Africa ───
  HECA:{iata:'CAI',name:'Cairo Intl',city:'Cairo',country:'EG',lat:30.1219,lon:31.4056},
  HAAB:{iata:'ADD',name:'Bole Intl',city:'Addis Ababa',country:'ET',lat:8.9779,lon:38.7993},
  HKJK:{iata:'NBO',name:'Jomo Kenyatta',city:'Nairobi',country:'KE',lat:-1.3192,lon:36.9278},
  HUEN:{iata:'EBB',name:'Entebbe Intl',city:'Entebbe',country:'UG',lat:0.0424,lon:32.4435},
  HTKJ:{iata:'JRO',name:'Kilimanjaro Intl',city:'Kilimanjaro',country:'TZ',lat:-3.4294,lon:37.0745},
  HTDA:{iata:'DAR',name:'Julius Nyerere',city:'Dar es Salaam',country:'TZ',lat:-6.8781,lon:39.2026},
  GMMN:{iata:'CMN',name:'Mohammed V',city:'Casablanca',country:'MA',lat:33.3675,lon:-7.5898},
  DTTA:{iata:'TUN',name:'Tunis-Carthage',city:'Tunis',country:'TN',lat:36.8510,lon:10.2272},
  DAAG:{iata:'ALG',name:'Houari Boumediene',city:'Algiers',country:'DZ',lat:36.6911,lon:3.2154},
  DNMM:{iata:'LOS',name:'Murtala Muhammed',city:'Lagos',country:'NG',lat:6.5774,lon:3.3212},
  GOOY:{iata:'DSS',name:'Blaise Diagne',city:'Dakar',country:'SN',lat:14.6708,lon:-17.0731},
  FAJS:{iata:'JNB',name:'O. R. Tambo',city:'Johannesburg',country:'ZA',lat:-26.1392,lon:28.2461},
  FACT:{iata:'CPT',name:'Cape Town Intl',city:'Cape Town',country:'ZA',lat:-33.9715,lon:18.6021},
  FALE:{iata:'DUR',name:'King Shaka',city:'Durban',country:'ZA',lat:-29.6144,lon:31.1197},

  // ─── East Asia ───
  RJTT:{iata:'HND',name:'Haneda',city:'Tokyo',country:'JP',lat:35.5494,lon:139.7798},
  RJAA:{iata:'NRT',name:'Narita Intl',city:'Tokyo',country:'JP',lat:35.7720,lon:140.3929},
  RJBB:{iata:'KIX',name:'Kansai Intl',city:'Osaka',country:'JP',lat:34.4274,lon:135.2440},
  RJOO:{iata:'ITM',name:'Itami',city:'Osaka',country:'JP',lat:34.7855,lon:135.4382},
  RJCC:{iata:'CTS',name:'New Chitose',city:'Sapporo',country:'JP',lat:42.7752,lon:141.6923},
  RJFF:{iata:'FUK',name:'Fukuoka',city:'Fukuoka',country:'JP',lat:33.5859,lon:130.4509},
  ROAH:{iata:'OKA',name:'Naha',city:'Okinawa',country:'JP',lat:26.1958,lon:127.6458},
  RKSI:{iata:'ICN',name:'Incheon Intl',city:'Seoul',country:'KR',lat:37.4602,lon:126.4407},
  RKSS:{iata:'GMP',name:'Gimpo Intl',city:'Seoul',country:'KR',lat:37.5583,lon:126.7906},
  RKPC:{iata:'CJU',name:'Jeju Intl',city:'Jeju',country:'KR',lat:33.5113,lon:126.4930},
  ZBAA:{iata:'PEK',name:'Beijing Capital',city:'Beijing',country:'CN',lat:40.0801,lon:116.5846},
  ZBAD:{iata:'PKX',name:'Beijing Daxing',city:'Beijing',country:'CN',lat:39.5098,lon:116.4106},
  ZSPD:{iata:'PVG',name:'Pudong Intl',city:'Shanghai',country:'CN',lat:31.1434,lon:121.8052},
  ZSSS:{iata:'SHA',name:'Hongqiao Intl',city:'Shanghai',country:'CN',lat:31.1979,lon:121.3363},
  ZGGG:{iata:'CAN',name:'Baiyun Intl',city:'Guangzhou',country:'CN',lat:23.3924,lon:113.2988},
  ZGSZ:{iata:'SZX',name:"Bao'an Intl",city:'Shenzhen',country:'CN',lat:22.6393,lon:113.8108},
  ZUUU:{iata:'CTU',name:'Shuangliu Intl',city:'Chengdu',country:'CN',lat:30.5785,lon:103.9471},
  ZSAM:{iata:'XMN',name:'Gaoqi Intl',city:'Xiamen',country:'CN',lat:24.5440,lon:118.1278},
  VHHH:{iata:'HKG',name:'Hong Kong Intl',city:'Hong Kong',country:'HK',lat:22.3080,lon:113.9185},
  RCTP:{iata:'TPE',name:'Taoyuan Intl',city:'Taipei',country:'TW',lat:25.0797,lon:121.2342},
  RCSS:{iata:'TSA',name:'Taipei Songshan',city:'Taipei',country:'TW',lat:25.0697,lon:121.5522},
  RCKH:{iata:'KHH',name:'Kaohsiung Intl',city:'Kaohsiung',country:'TW',lat:22.5771,lon:120.3502},

  // ─── Southeast Asia ───
  WSSS:{iata:'SIN',name:'Changi',city:'Singapore',country:'SG',lat:1.3644,lon:103.9915},
  WMKK:{iata:'KUL',name:'Kuala Lumpur Intl',city:'Kuala Lumpur',country:'MY',lat:2.7456,lon:101.7099},
  WMKP:{iata:'PEN',name:'Penang Intl',city:'Penang',country:'MY',lat:5.2971,lon:100.2766},
  WIII:{iata:'CGK',name:'Soekarno-Hatta',city:'Jakarta',country:'ID',lat:-6.1256,lon:106.6559},
  WADD:{iata:'DPS',name:'Ngurah Rai',city:'Bali',country:'ID',lat:-8.7482,lon:115.1672},
  RPLL:{iata:'MNL',name:'Ninoy Aquino',city:'Manila',country:'PH',lat:14.5086,lon:121.0194},
  RPVM:{iata:'CEB',name:'Mactan-Cebu',city:'Cebu',country:'PH',lat:10.3074,lon:123.9794},
  VTBS:{iata:'BKK',name:'Suvarnabhumi',city:'Bangkok',country:'TH',lat:13.6900,lon:100.7501},
  VTBD:{iata:'DMK',name:'Don Mueang',city:'Bangkok',country:'TH',lat:13.9126,lon:100.6068},
  VTSP:{iata:'HKT',name:'Phuket Intl',city:'Phuket',country:'TH',lat:8.1132,lon:98.3169},
  VTCC:{iata:'CNX',name:'Chiang Mai Intl',city:'Chiang Mai',country:'TH',lat:18.7668,lon:98.9627},
  VVTS:{iata:'SGN',name:'Tan Son Nhat',city:'Ho Chi Minh',country:'VN',lat:10.8188,lon:106.6520},
  VVNB:{iata:'HAN',name:'Noi Bai',city:'Hanoi',country:'VN',lat:21.2212,lon:105.8071},
  VDPP:{iata:'PNH',name:'Phnom Penh Intl',city:'Phnom Penh',country:'KH',lat:11.5466,lon:104.8441},
  VDSR:{iata:'REP',name:'Siem Reap Intl',city:'Siem Reap',country:'KH',lat:13.4097,lon:103.8131},
  VYYY:{iata:'RGN',name:'Yangon Intl',city:'Yangon',country:'MM',lat:16.9073,lon:96.1332},

  // ─── South Asia ───
  VABB:{iata:'BOM',name:'Chhatrapati Shivaji',city:'Mumbai',country:'IN',lat:19.0887,lon:72.8679},
  VIDP:{iata:'DEL',name:'Indira Gandhi',city:'Delhi',country:'IN',lat:28.5562,lon:77.1000},
  VOMM:{iata:'MAA',name:'Chennai Intl',city:'Chennai',country:'IN',lat:12.9941,lon:80.1709},
  VOBL:{iata:'BLR',name:'Kempegowda Intl',city:'Bangalore',country:'IN',lat:13.1986,lon:77.7066},
  VOHS:{iata:'HYD',name:'Rajiv Gandhi Intl',city:'Hyderabad',country:'IN',lat:17.2403,lon:78.4294},
  VECC:{iata:'CCU',name:'Netaji Subhas Chandra',city:'Kolkata',country:'IN',lat:22.6547,lon:88.4467},
  VOCI:{iata:'COK',name:'Cochin Intl',city:'Kochi',country:'IN',lat:10.1520,lon:76.4019},
  VOTV:{iata:'TRV',name:'Trivandrum Intl',city:'Thiruvananthapuram',country:'IN',lat:8.4821,lon:76.9200},
  VOGO:{iata:'GOI',name:'Goa Dabolim',city:'Goa',country:'IN',lat:15.3808,lon:73.8314},
  OPKC:{iata:'KHI',name:'Jinnah Intl',city:'Karachi',country:'PK',lat:24.9065,lon:67.1608},
  OPLA:{iata:'LHE',name:'Allama Iqbal',city:'Lahore',country:'PK',lat:31.5216,lon:74.4036},
  OPIS:{iata:'ISB',name:'Islamabad Intl',city:'Islamabad',country:'PK',lat:33.5491,lon:72.8258},
  VGHS:{iata:'DAC',name:'Hazrat Shahjalal',city:'Dhaka',country:'BD',lat:23.8433,lon:90.3978},
  VCBI:{iata:'CMB',name:'Bandaranaike Intl',city:'Colombo',country:'LK',lat:7.1808,lon:79.8841},

  // ─── Oceania ───
  YSSY:{iata:'SYD',name:'Kingsford Smith',city:'Sydney',country:'AU',lat:-33.9399,lon:151.1753},
  YMML:{iata:'MEL',name:'Melbourne Tullamarine',city:'Melbourne',country:'AU',lat:-37.6690,lon:144.8410},
  YBBN:{iata:'BNE',name:'Brisbane Intl',city:'Brisbane',country:'AU',lat:-27.3942,lon:153.1218},
  YPPH:{iata:'PER',name:'Perth Intl',city:'Perth',country:'AU',lat:-31.9403,lon:115.9669},
  YPAD:{iata:'ADL',name:'Adelaide Intl',city:'Adelaide',country:'AU',lat:-34.9461,lon:138.5306},
  YBCS:{iata:'CNS',name:'Cairns Intl',city:'Cairns',country:'AU',lat:-16.8858,lon:145.7553},
  NZAA:{iata:'AKL',name:'Auckland Intl',city:'Auckland',country:'NZ',lat:-37.0080,lon:174.7917},
  NZWN:{iata:'WLG',name:'Wellington Intl',city:'Wellington',country:'NZ',lat:-41.3272,lon:174.8053},
  NZCH:{iata:'CHC',name:'Christchurch Intl',city:'Christchurch',country:'NZ',lat:-43.4894,lon:172.5320},
  NZQN:{iata:'ZQN',name:'Queenstown',city:'Queenstown',country:'NZ',lat:-45.0211,lon:168.7392},
  NFFN:{iata:'NAN',name:'Nadi Intl',city:'Nadi',country:'FJ',lat:-17.7553,lon:177.4434},
};

/* ─────────────────────────────────────────
   App state
   ───────────────────────────────────────── */
const state = {
  map: null,
  routeLayer: null,
  flownLayer: null,
  fromMarker: null,
  toMarker: null,
  planeMarker: null,
  refreshTimer:   null,  // 30s API poll for real position updates
  animationTimer: null,  // 1s tick for dead-reckoning the plane between polls
  weatherTimer:   null,  // 10min refresh for destination weather
  lastFix:        null,  // { lat, lon, speedKt, headingDeg, altFt, time, raw }
  lastWeather:    null,  // last Open-Meteo `current` payload, used by transport notes
  currentCallsign: null,
  currentIcao24: null,
  currentRoute: null,
  recent: [],
};

/* ─────────────────────────────────────────
   DOM refs
   ───────────────────────────────────────── */
const $ = (sel) => document.querySelector(sel);
const els = {
  form:            $('#searchForm'),
  input:           $('#flightInput'),
  hero:            $('#hero'),
  tracker:         $('#tracker'),
  loading:         $('#loadingState'),
  error:           $('#errorState'),
  errorTitle:      $('#errorTitle'),
  errorSub:        $('#errorSub'),
  recent:          $('#recent'),
  recentChips:     $('#recentChips'),
  callsignBadge:   $('#callsignBadge'),
  fromAirport:     $('#fromAirport'),
  toAirport:       $('#toAirport'),
  lastUpdated:     $('#lastUpdated'),
  refreshBtn:      null,  // removed — auto-updating now
  statAltitude:    $('#statAltitude'),
  statSpeed:       $('#statSpeed'),
  statHeading:     $('#statHeading'),
  statOrigin:      $('#statOrigin'),
  loveNote:        $('#loveNote'),
  loveNoteText:    $('#loveNoteText'),
  progressFill:    $('#progressFill'),
  progressPlane:   $('#progressPlane'),
  progressPercent: $('#progressPercent'),
  progressFromCode:$('#progressFromCode'),
  progressToCode:  $('#progressToCode'),
  distFlown:       $('#distFlown'),
  distRemaining:   $('#distRemaining'),
  etaValue:        $('#etaValue'),
  etaSub:          $('#etaSub'),
  // Arrival card (weather + transport)
  arrivalCard:      $('#arrivalCard'),
  arrivalCity:      $('#arrivalCity'),
  arrivalLocalTime: $('#arrivalLocalTime'),
  weatherIcon:      $('#weatherIcon'),
  weatherTemp:      $('#weatherTemp'),
  weatherCond:      $('#weatherCond'),
  weatherDetail:    $('#weatherDetail'),
  weatherNote:      $('#weatherNote'),
  transportNote:    $('#transportNote'),
};

/* ─────────────────────────────────────────
   Persistence (recent flights only)
   ───────────────────────────────────────── */
function loadStored() {
  try {
    const raw = localStorage.getItem(CONFIG.storageKey);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (Array.isArray(data.recent)) state.recent = data.recent.slice(0, 6);
    renderRecent();
  } catch (_) { /* ignore */ }
}
function saveStored() {
  try {
    localStorage.setItem(CONFIG.storageKey, JSON.stringify({ recent: state.recent }));
  } catch (_) { /* ignore */ }
}
function pushRecent(flightNumber) {
  state.recent = [flightNumber, ...state.recent.filter(f => f !== flightNumber)].slice(0, 6);
  saveStored();
  renderRecent();
}
function renderRecent() {
  if (!state.recent.length) { els.recent.hidden = true; return; }
  els.recent.hidden = false;
  els.recentChips.innerHTML = '';
  state.recent.forEach(f => {
    const btn = document.createElement('button');
    btn.className = 'chip';
    btn.type = 'button';
    btn.textContent = f;
    btn.addEventListener('click', () => {
      els.input.value = f;
      els.form.requestSubmit();
    });
    els.recentChips.appendChild(btn);
  });
}

/* ─────────────────────────────────────────
   Helpers
   ───────────────────────────────────────── */
function normalizeFlight(input) {
  return input.trim().toUpperCase().replace(/\s+/g, '');
}

/** Convert a typed flight number ("BA286") into possible callsigns ("BAW286"). */
function flightToCallsigns(flight) {
  const m = flight.match(/^([A-Z0-9]{2,3})(\d{1,5}[A-Z]?)$/);
  if (!m) return [];
  const prefix = m[1], num = m[2];
  const candidates = new Set();
  candidates.add(prefix + num);                          // already ICAO?
  if (AIRLINES[prefix]) candidates.add(AIRLINES[prefix] + num);
  return [...candidates];
}

/** Great-circle interpolation between two lat/lon points. */
function greatCirclePath(lat1, lon1, lat2, lon2, n = 128) {
  if (!Number.isFinite(lat1) || !Number.isFinite(lon1) ||
      !Number.isFinite(lat2) || !Number.isFinite(lon2)) {
    return [[lat1 || 0, lon1 || 0], [lat2 || 0, lon2 || 0]];
  }
  const toRad = (d) => d * Math.PI / 180;
  const toDeg = (r) => r * 180 / Math.PI;
  const φ1 = toRad(lat1), λ1 = toRad(lon1);
  const φ2 = toRad(lat2), λ2 = toRad(lon2);
  const Δσ = Math.acos(Math.min(1, Math.max(-1,
    Math.sin(φ1) * Math.sin(φ2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1)
  )));
  if (!Number.isFinite(Δσ) || Δσ === 0) return [[lat1, lon1], [lat2, lon2]];
  const points = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n;
    const A = Math.sin((1 - f) * Δσ) / Math.sin(Δσ);
    const B = Math.sin(f * Δσ) / Math.sin(Δσ);
    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
    const z = A * Math.sin(φ1) + B * Math.sin(φ2);
    const φ = Math.atan2(z, Math.sqrt(x * x + y * y));
    const λ = Math.atan2(y, x);
    const lat = toDeg(φ), lon = toDeg(λ);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      points.push([lat, lon]);
    }
  }
  return points.length ? points : [[lat1, lon1], [lat2, lon2]];
}

/** Distance in km between two lat/lon points (haversine). */
function haversineKm(lat1, lon1, lat2, lon2) {
  if (!Number.isFinite(lat1) || !Number.isFinite(lon1) ||
      !Number.isFinite(lat2) || !Number.isFinite(lon2)) return 0;
  const R = 6371;
  const toRad = (d) => d * Math.PI / 180;
  const dφ = toRad(lat2 - lat1);
  const dλ = toRad(lon2 - lon1);
  const a = Math.sin(dφ / 2) ** 2
          + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dλ / 2) ** 2;
  const result = 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  return Number.isFinite(result) ? result : 0;
}

/** Initial bearing in degrees (0–360) along the great circle from p1 to p2. */
function bearingDeg(lat1, lon1, lat2, lon2) {
  if (!Number.isFinite(lat1) || !Number.isFinite(lon1) ||
      !Number.isFinite(lat2) || !Number.isFinite(lon2)) return 0;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const y  = Math.sin(Δλ) * Math.cos(φ2);
  const x  = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const deg = ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
  return Number.isFinite(deg) ? deg : 0;
}

/** Project a starting point along an initial bearing for distanceKm.
 *  Used for dead-reckoning the plane's position between API polls. */
function projectByBearing(lat, lon, bearingDegrees, distanceKm) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) ||
      !Number.isFinite(bearingDegrees) || !Number.isFinite(distanceKm)) {
    return [lat, lon];
  }
  const R  = 6371;
  const δ  = distanceKm / R;
  const θ  = bearingDegrees * Math.PI / 180;
  const φ1 = lat * Math.PI / 180;
  const λ1 = lon * Math.PI / 180;
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 = λ1 + Math.atan2(
    Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
    Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2)
  );
  const outLat = φ2 * 180 / Math.PI;
  const outLon = ((λ2 * 180 / Math.PI + 540) % 360) - 180;
  return [
    Number.isFinite(outLat) ? outLat : lat,
    Number.isFinite(outLon) ? outLon : lon,
  ];
}

const fmt = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
function formatKm(km)              { return `${fmt(km)} km`; }
function formatFt(ft)              { return fmt(ft); }            // already feet from adsb.lol
function formatMphFromKt(kt)       { return `${Math.round(kt * 1.15078)}`; }
function formatRelative(secsAgo) {
  if (secsAgo < 60) return `${Math.max(0, Math.floor(secsAgo))}s ago`;
  if (secsAgo < 3600) return `${Math.floor(secsAgo / 60)}m ago`;
  return `${Math.floor(secsAgo / 3600)}h ago`;
}
function setUpdated(secsAgo) {
  if (secsAgo == null || !isFinite(secsAgo)) { els.lastUpdated.textContent = '—'; return; }
  els.lastUpdated.textContent = `updated ${formatRelative(secsAgo)}`;
}
function numOrNull(v) { return (typeof v === 'number' && isFinite(v)) ? v : null; }
/** Sanity-check a lat/lon pair. Rejects NaN/Infinity/non-numbers AND the
 *  classic "null island" (0, 0) which often signals untracked aircraft. */
function validCoord(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon))    return false;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180)         return false;
  if (lat === 0 && lon === 0)                            return false;
  return true;
}

/* ─────────────────────────────────────────
   API — adsb.lol: live aircraft by callsign
   ───────────────────────────────────────── */

// Wraps fetch through CORS proxies so static-site requests survive browser
// same-origin enforcement. Tries direct first, then walks a chain of public
// proxies. Logs every attempt so failures are diagnosable from devtools.
/** Wraps fetch through CORS proxies and returns PARSED JSON.
 *  Critical detail: a proxy can return HTTP 200 with an empty or non-JSON
 *  body when it fails to proxy POST properly. We must read+parse the body
 *  inside the proxy loop so we can fall through to the next proxy on
 *  empty/garbage responses, instead of returning a broken success. */
async function corsFetch(targetUrl, options = {}) {
  const init = {
    method:  options.method  || 'GET',
    headers: { 'Accept': 'application/json', ...(options.headers || {}) },
  };
  if (options.body !== undefined) {
    init.body = options.body;
    init.headers['Content-Type'] = init.headers['Content-Type'] || 'application/json';
  }

  const tryFetch = async (url, label) => {
    const res = await fetch(url, init);
    if (!res.ok) throw new Error(`${label} returned ${res.status}`);
    const text = await res.text();
    if (!text || !text.trim()) throw new Error(`${label} returned empty body`);
    let data;
    try { data = JSON.parse(text); }
    catch (_) { throw new Error(`${label} returned non-JSON body`); }
    return { data, text, response: res };
  };

  // 1. Try direct (works if the API has open CORS for our origin)
  try {
    const result = await tryFetch(targetUrl, 'direct');
    return result;
  } catch (e) {
    console.warn('[skyward] direct fetch failed for', targetUrl, '—', e.message);
  }

  // 2. Walk every proxy. Each is independently tried; only return on a real
  //    parsed success. An empty 200 from one proxy will fall through to the
  //    next, instead of being mistaken for a successful response.
  let lastErr = null;
  for (const buildProxyUrl of CONFIG.corsProxies) {
    const proxiedUrl = buildProxyUrl(targetUrl);
    const proxyName  = new URL(proxiedUrl).hostname;
    try {
      const result = await tryFetch(proxiedUrl, `proxy ${proxyName}`);
      console.log('[skyward] proxy hit:', proxyName);
      return result;
    } catch (e) {
      lastErr = e;
      console.warn('[skyward] proxy', proxyName, 'failed:', e.message);
    }
  }
  throw lastErr || new Error(`all fetch attempts failed for ${targetUrl}`);
}

/** Returns an array of candidate aircraft (with positions) matching the
 *  callsign. Exact callsign matches are preferred; if none match exactly we
 *  still return any positioned aircraft so the route-based picker can score
 *  them. May return [] if none are airborne with that callsign. */
async function fetchAircraftListByCallsign(callsign) {
  const url = `${CONFIG.adsbBase}/callsign/${encodeURIComponent(callsign)}`;
  console.log('[skyward] fetching aircraft for callsign', callsign);
  const { data } = await corsFetch(url);
  const list = (data && data.ac) || [];
  console.log('[skyward] adsb.lol returned', list.length, 'aircraft for', callsign);
  if (!list.length) return [];

  const withPos = list.filter(a => validCoord(a.lat, a.lon));
  if (!withPos.length) return [];

  const target = callsign.trim().toUpperCase();
  const exact = withPos.filter(a => (a.flight || '').trim().toUpperCase() === target);
  return exact.length ? exact : withPos;
}

/** Score an aircraft on how plausible it is for the given route.
 *  Higher = better. 100 = perfectly on path with right heading. */
function scoreRouteConsistency(ac, route) {
  if (!route || ac.lat == null || ac.lon == null) return 0;
  let score = 100;

  // Off-path penalty: detour = (origin→ac) + (ac→dest) − (origin→dest). 0 = on path.
  const totalKm    = haversineKm(route.from.lat, route.from.lon, route.to.lat, route.to.lon);
  const fromDistKm = haversineKm(route.from.lat, route.from.lon, ac.lat, ac.lon);
  const toDistKm   = haversineKm(route.to.lat,   route.to.lon,   ac.lat, ac.lon);
  const detour     = Math.max(0, (fromDistKm + toDistKm) - totalKm);
  score -= detour / 50;  // ~1 point per 50 km off-path

  // Heading should point roughly toward the destination
  if (typeof ac.track === 'number') {
    const bToDest = bearingDeg(ac.lat, ac.lon, route.to.lat, route.to.lon);
    const diff    = Math.abs(((ac.track - bToDest + 540) % 360) - 180);
    score -= diff / 5;  // ~1 point per 5° of heading mismatch
  }
  return score;
}

/** Among multiple aircraft sharing a callsign, pick the one whose position
 *  and heading are most consistent with the looked-up route. If route is
 *  unknown, just return the first. */
function pickBestAircraft(list, route) {
  if (!list.length) return null;
  if (list.length === 1 || !route) return list[0];

  const scored = list.map(a => ({ ac: a, score: scoreRouteConsistency(a, route) }));
  scored.sort((x, y) => y.score - x.score);
  console.log('[skyward] picked aircraft from', list.length, 'candidates; top score:',
              scored[0].score.toFixed(1));
  return scored[0].ac;
}

/* ─────────────────────────────────────────
   API — route lookup (verified multi-source)
   We query adsb.lol, adsbdb, AND hexdb in parallel, then verify each route
   against the aircraft's actual position. The route whose origin→destination
   line passes nearest the plane wins. This way we get coverage (no more
   "no route at all") AND correctness (no more wrong cities) at once.
   Returns { from, to, source, score } or null.
   ───────────────────────────────────────── */
async function fetchRouteByCallsign(callsign, lat = 0, lon = 0) {
  const cs = (callsign || '').trim();
  if (!cs) return null;

  console.log('[skyward] looking up route for', cs, 'at', lat?.toFixed?.(2), lon?.toFixed?.(2));

  // Run all three lookups concurrently — fastest path to coverage.
  const results = await Promise.allSettled([
    routeFromAdsblol(cs, lat, lon),
    routeFromAdsbdb(cs),
    routeFromHexdb(cs),
  ]);

  // Collect only the lookups that produced a usable route with valid coords.
  const candidates = [];
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value &&
        validCoord(r.value.from.lat, r.value.from.lon) &&
        validCoord(r.value.to.lat,   r.value.to.lon)) {
      candidates.push(r.value);
    }
  }

  if (!candidates.length) {
    console.warn('[skyward] no source returned a route for', cs);
    return null;
  }

  // No aircraft position to verify against → trust adsb.lol's order-of-listing.
  if (!validCoord(lat, lon)) {
    console.log('[skyward] no aircraft position — using first available source:', candidates[0].source);
    return candidates[0];
  }

  // Score each candidate by how plausible it is given the actual position.
  // Reuses scoreRouteConsistency by treating the position as a tiny aircraft.
  const fakeAircraft = { lat, lon, track: null };
  const scored = candidates.map(c => ({
    route: c,
    score: scoreRouteConsistency(fakeAircraft, c),
  }));
  scored.sort((a, b) => b.score - a.score);

  for (const s of scored) {
    console.log(`[skyward]   ${s.route.source}: ${s.route.from.iata}→${s.route.to.iata} (score ${s.score.toFixed(1)})`);
  }

  const winner = scored[0];
  // If even the best candidate is wildly off the actual position, all sources
  // are likely wrong — refuse to display rather than draw a bad line.
  if (winner.score < 30) {
    console.warn('[skyward] best route score', winner.score.toFixed(1), '— too inconsistent with position; suppressing');
    return null;
  }
  console.log(`[skyward] ✓ chose ${winner.route.source}: ${winner.route.from.city || winner.route.from.iata} → ${winner.route.to.city || winner.route.to.iata}`);
  return { ...winner.route, score: winner.score };
}

// ── Source 1: adsb.lol's /api/0/routeset (matches adsb.lol website) ──
async function routeFromAdsblol(cs, lat, lon) {
  try {
    const url  = `${CONFIG.adsbBase.replace(/\/v2$/, '')}/api/0/routeset`;
    const body = JSON.stringify({ planes: [{ callsign: cs, lat, lng: lon }] });
    const { data } = await corsFetch(url, { method: 'POST', body });
    const entry = Array.isArray(data) ? data[0] : null;
    if (!entry || !Array.isArray(entry._airports) || entry._airports.length < 2) return null;
    const origin = entry._airports[0];
    const dest   = entry._airports[entry._airports.length - 1];
    if (!validCoord(origin.lat, origin.lon) || !validCoord(dest.lat, dest.lon)) return null;
    return {
      from:   airportFromAdsblol(origin),
      to:     airportFromAdsblol(dest),
      source: 'adsb.lol',
    };
  } catch (e) {
    console.warn('[skyward] adsb.lol routeset failed:', e.message);
    return null;
  }
}

// ── Source 2: adsbdb.com (open-source flight-route DB with airport coords) ──
async function routeFromAdsbdb(cs) {
  try {
    const url  = `${CONFIG.adsbdbBase}/callsign/${encodeURIComponent(cs)}`;
    const { data } = await corsFetch(url);
    const fr   = data && data.response && data.response.flightroute;
    if (!fr || !fr.origin || !fr.destination) return null;
    if (!Number.isFinite(fr.origin.latitude) || !Number.isFinite(fr.origin.longitude) ||
        !Number.isFinite(fr.destination.latitude) || !Number.isFinite(fr.destination.longitude)) return null;
    return {
      from:   airportFromAdsbdb(fr.origin),
      to:     airportFromAdsbdb(fr.destination),
      source: 'adsbdb',
    };
  } catch (e) {
    console.warn('[skyward] adsbdb route lookup failed:', e.message);
    return null;
  }
}

// ── Source 3: hexdb.io (returns ICAO codes; airports come from local table) ──
async function routeFromHexdb(cs) {
  try {
    const url  = `${CONFIG.hexdbBase}/route/icao/${encodeURIComponent(cs)}`;
    const { data } = await corsFetch(url);
    if (!data || !data.route) return null;
    const parts  = String(data.route).split('-').map(s => s.trim()).filter(Boolean);
    if (parts.length < 2) return null;
    const fromAp = AIRPORTS[parts[0]];
    const toAp   = AIRPORTS[parts[parts.length - 1]];
    if (!fromAp || !toAp) return null;
    return {
      from:   { ...fromAp, icao: parts[0] },
      to:     { ...toAp,   icao: parts[parts.length - 1] },
      source: 'hexdb',
    };
  } catch (e) {
    console.warn('[skyward] hexdb route lookup failed:', e.message);
    return null;
  }
}

// Normalize an adsb.lol routeset airport entry into our standard airport shape
function airportFromAdsblol(a) {
  return {
    iata:    a.iata    || '',
    icao:    a.icao    || '',
    name:    a.name    || '',
    city:    a.location|| a.name || '',
    country: a.countryiso2 || '',
    lat:     a.lat,
    lon:     a.lon,
  };
}

// Normalize an adsbdb origin/destination object into our standard airport shape
function airportFromAdsbdb(a) {
  return {
    iata:    a.iata_code || '',
    icao:    a.icao_code || '',
    name:    a.name || '',
    city:    a.municipality || a.name || '',
    country: a.country_iso_name || a.country_name || '',
    lat:     a.latitude,
    lon:     a.longitude,
  };
}

/* ─────────────────────────────────────────
   Map
   ───────────────────────────────────────── */
function ensureMap() {
  if (state.map) return state.map;
  state.map = L.map('map', {
    zoomControl: true, attributionControl: true, worldCopyJump: true,
    minZoom: 2, maxZoom: 12,
  }).setView([20, 0], 2);

  L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    {
      subdomains: 'abcd',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 18,
    }
  ).addTo(state.map);
  return state.map;
}

function clearMapLayers() {
  ['routeLayer','flownLayer','fromMarker','toMarker','planeMarker'].forEach(k => {
    if (state[k]) { state.map.removeLayer(state[k]); state[k] = null; }
  });
}

function airportIcon(kind) {
  return L.divIcon({
    className: '',
    html: `<div class="airport-marker ${kind}"></div>`,
    iconSize: [18, 18], iconAnchor: [9, 9],
  });
}

function planeIcon(headingDeg) {
  const rot = headingDeg ?? 0;
  return L.divIcon({
    className: '',
    html: `
      <div class="plane-marker" style="transform: rotate(${rot - 90}deg);">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2 L13.5 9 L22 12 L13.5 13.5 L12 22 L10.5 13.5 L2 12 L10.5 9 Z"/>
        </svg>
      </div>`,
    iconSize: [36, 36], iconAnchor: [18, 18],
  });
}

/* ─────────────────────────────────────────
   Render: route, plane, stats
   ───────────────────────────────────────── */
function renderRoute(from, to, timing) {
  if (!from || !to ||
      !validCoord(from.lat, from.lon) ||
      !validCoord(to.lat,   to.lon)) {
    console.warn('[skyward] renderRoute called with invalid coordinates — skipping');
    return;
  }

  const path = greatCirclePath(from.lat, from.lon, to.lat, to.lon, 128);
  state.routeLayer = L.polyline(path, {
    color: '#e9b872', weight: 2, opacity: 0.55,
    dashArray: '6, 8', lineCap: 'round',
  }).addTo(state.map);

  // Permanent, always-visible labels for departure & arrival airports
  const departTime = (timing && timing.departText) ? timing.departText : '';
  const arriveTime = (timing && timing.arriveText) ? timing.arriveText : '';

  state.fromMarker = L.marker([from.lat, from.lon], { icon: airportIcon('from') })
    .bindTooltip(buildAirportLabel('Departed', from, departTime), {
      permanent: true, direction: 'right', offset: [12, 0],
      className: 'airport-label airport-label-from',
    })
    .addTo(state.map);

  state.toMarker = L.marker([to.lat, to.lon], { icon: airportIcon('to') })
    .bindTooltip(buildAirportLabel('Arriving', to, arriveTime), {
      permanent: true, direction: 'left', offset: [-12, 0],
      className: 'airport-label airport-label-to',
    })
    .addTo(state.map);
}

function buildAirportLabel(headline, ap, time) {
  // headline: "Departed" or "Arriving"; ap: airport object; time: HH:MM string or ''
  const code = (ap.iata || ap.icao || '???').toUpperCase();
  const place = ap.city || ap.name || '';
  const timeRow = time ? `<div class="airport-label-time">${headline.toLowerCase()} ${time}</div>` : '';
  return `
    <div class="airport-label-headline">${headline}</div>
    <div class="airport-label-code">${code}</div>
    <div class="airport-label-city">${place}</div>
    ${timeRow}
  `;
}

// Update the permanent labels in place when timing changes (called on each refresh)
function updateRouteLabels(from, to, timing) {
  if (state.fromMarker) {
    const t = (timing && timing.departText) ? timing.departText : '';
    state.fromMarker.setTooltipContent(buildAirportLabel('Departed', from, t));
  }
  if (state.toMarker) {
    const t = (timing && timing.arriveText) ? timing.arriveText : '';
    state.toMarker.setTooltipContent(buildAirportLabel('Arriving', to, t));
  }
}

function renderFlownPath(from, currentLat, currentLon) {
  const flown = greatCirclePath(from.lat, from.lon, currentLat, currentLon, 64);
  if (state.flownLayer) {
    // Update in place — much cheaper than removing & re-adding every animation tick
    state.flownLayer.setLatLngs(flown);
  } else {
    state.flownLayer = L.polyline(flown, {
      color: '#f4cf94', weight: 3, opacity: 0.9, lineCap: 'round',
    }).addTo(state.map);
  }
}

function renderPlane(lat, lon, heading) {
  if (!validCoord(lat, lon)) return;
  if (state.planeMarker) {
    state.planeMarker.setLatLng([lat, lon]);
    state.planeMarker.setIcon(planeIcon(heading));
  } else {
    state.planeMarker = L.marker([lat, lon], {
      icon: planeIcon(heading), zIndexOffset: 1000,
    }).addTo(state.map);
  }
}

function fitMapToFlight(from, to, planeLat, planeLon) {
  const points = [];
  if (from && validCoord(from.lat, from.lon)) points.push([from.lat, from.lon]);
  if (to   && validCoord(to.lat,   to.lon))   points.push([to.lat,   to.lon]);
  if (validCoord(planeLat, planeLon))         points.push([planeLat, planeLon]);
  if (points.length === 1)      state.map.setView(points[0], 6);
  else if (points.length > 1)   state.map.fitBounds(points, { padding: [60, 60], maxZoom: 7 });
}

/** Estimate departure & arrival times from current speed and progress.
 *  Returns { departText, arriveText, remainingHuman } — all may be ''
 *  if speed is too low to make a meaningful estimate. */
function computeTiming(speedKt, flownKm, remainingKm) {
  const out = { departText: '', arriveText: '', remainingHuman: '' };
  // Need a real cruising speed to make any estimate
  if (!speedKt || speedKt < 100) return out;

  const speedKmh = speedKt * 1.852;
  const remainingHours = remainingKm / speedKmh;
  const elapsedHours   = flownKm / speedKmh;

  const now = Date.now();
  const arriveAt = new Date(now + remainingHours * 3600 * 1000);
  const departAt = new Date(now - elapsedHours   * 3600 * 1000);

  const fmt = d => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  out.arriveText = fmt(arriveAt);
  out.departText = fmt(departAt);

  const h = Math.floor(remainingHours);
  const m = Math.round((remainingHours - h) * 60);
  out.remainingHuman = h > 0 ? `${h}h ${m}m` : `${m}m`;
  return out;
}

/* ─────────────────────────────────────────
   Destination weather (Open-Meteo) + cute notes
   Open-Meteo is free, no key needed, and CORS-friendly. We pull the current
   conditions for the destination airport coords and turn the result into a
   warm, plain-English what-to-wear note. Refreshes every 10 minutes.
   ───────────────────────────────────────── */

async function fetchDestinationWeather(lat, lon) {
  const params = new URLSearchParams({
    latitude:           String(lat),
    longitude:          String(lon),
    current:            'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation,is_day',
    temperature_unit:   'fahrenheit',
    wind_speed_unit:    'mph',
  });
  const url = `${CONFIG.weatherBase}?${params}`;
  const { data } = await corsFetch(url);
  return data.current || null;
}

// WMO weather code → friendly label and a small monochrome glyph
function decodeWeather(code, isDay) {
  const t = (day, night) => isDay === 0 ? night : day;
  const codes = {
    0:  ['Clear sky',           t('☼','☾')],
    1:  ['Mostly clear',        t('☼','☾')],
    2:  ['Partly cloudy',       '☁'],
    3:  ['Overcast',            '☁'],
    45: ['Foggy',               '≋'],
    48: ['Freezing fog',        '≋'],
    51: ['Light drizzle',       '☂'],
    53: ['Drizzle',             '☂'],
    55: ['Heavy drizzle',       '☂'],
    61: ['Light rain',          '☂'],
    63: ['Rain',                '☂'],
    65: ['Heavy rain',          '☂'],
    71: ['Light snow',          '❄'],
    73: ['Snow',                '❄'],
    75: ['Heavy snow',          '❄'],
    77: ['Snow grains',         '❄'],
    80: ['Showers',             '☂'],
    81: ['Showers',             '☂'],
    82: ['Heavy showers',       '☂'],
    85: ['Snow showers',        '❄'],
    86: ['Heavy snow showers',  '❄'],
    95: ['Thunderstorm',        '⚡'],
    96: ['Thunder + hail',      '⚡'],
    99: ['Severe thunderstorm', '⚡'],
  };
  return codes[code] || ['Mixed conditions', '☁'];
}

// Cute "what to wear" note tuned to temperature + conditions
function whatToWear(tempF, code, windMph, partnerName) {
  const isRain  = (code >= 51 && code <= 67) || (code >= 80 && code <= 82);
  const isSnow  = (code >= 71 && code <= 77) || (code >= 85 && code <= 86);
  const isStorm = code >= 95;
  const isWindy = windMph != null && windMph > 18;

  let layer;
  if      (tempF >= 88) layer = `linen and sandals — it's properly hot`;
  else if (tempF >= 75) layer = `a tee and her favorite sundress — it's warm`;
  else if (tempF >= 62) layer = `a light cardigan, just in case`;
  else if (tempF >= 50) layer = `a real jacket — there's a bite in the air`;
  else if (tempF >= 38) layer = `coat, scarf, the whole production`;
  else if (tempF >= 25) layer = `the heaviest coat she has, plus gloves`;
  else                   layer = `full winter armor — it's cold cold`;

  const extras = [];
  if (isRain)  extras.push("she'll want an umbrella");
  if (isSnow)  extras.push("waterproof boots, no shortcuts");
  if (isStorm) extras.push("just get inside fast");
  if (isWindy && !isRain && !isSnow) extras.push("something with sleeves — it's blustery");

  const tail = extras.length ? ` — ${extras.join(' & ')}.` : '.';
  return `${partnerName || 'She'}'ll want ${layer}${tail}`;
}

/* ─────────────────────────────────────────
   Airport transit lookup + transport notes
   Small curated table for the busiest airports — when we recognize one we
   give specific advice (which train, fare zone, etc). Otherwise we fall back
   to a generic suggestion that still respects time-of-day and weather.
   ───────────────────────────────────────── */
const AIRPORT_TRANSIT = {
  // North America
  KJFK: { transit: 'AirTrain → LIRR to Penn (~35 min)',         rideshare: 'Uber ~$60–90 to Manhattan' },
  KLGA: { transit: 'Q70 bus → 7 train (cheap, awkward)',         rideshare: 'Uber ~$45–60 to Manhattan' },
  KEWR: { transit: 'AirTrain → NJ Transit to Penn (~30 min)',    rideshare: 'Uber ~$70–100 to NYC' },
  KLAX: { transit: 'FlyAway bus or Metro K Line',                rideshare: 'Uber ~$45–70 most spots' },
  KSFO: { transit: 'BART straight downtown (~30 min)',           rideshare: 'Uber ~$45–65 to SF' },
  KOAK: { transit: 'AirConnect → BART (anywhere in the Bay)',    rideshare: 'Uber ~$35–55 to SF' },
  KORD: { transit: "Blue Line CTA to the Loop (~45 min)",        rideshare: 'Uber ~$40–55 to downtown' },
  KSEA: { transit: 'Link Light Rail to downtown (~40 min)',      rideshare: 'Uber ~$45–65 to downtown' },
  KBOS: { transit: 'Silver Line bus — free and direct',          rideshare: 'Uber ~$30–45 to downtown' },
  KDCA: { transit: 'Blue/Yellow Line metro right at terminal',   rideshare: 'Uber ~$15–25 to downtown' },
  KIAD: { transit: 'Silver Line metro to DC (~50 min)',          rideshare: 'Uber ~$50–80 to DC' },
  KBWI: { transit: 'MARC train to DC, Light Rail to Baltimore',  rideshare: 'Uber ~$50–75 to DC' },
  KATL: { transit: 'MARTA train direct (~20 min)',               rideshare: 'Uber ~$30–45 to downtown' },
  KMIA: { transit: 'Tri-Rail or Metrorail',                       rideshare: 'Uber ~$25–45 to South Beach' },
  KIAH: { transit: '(transit is limited — rideshare is faster)', rideshare: 'Uber ~$40–60 to downtown' },
  KDFW: { transit: 'DART Orange Line to downtown (~50 min)',     rideshare: 'Uber ~$35–55 to Dallas' },
  KLAS: { transit: '(none worth it from LAS)',                    rideshare: 'Uber ~$15–25 to the Strip' },
  KMSP: { transit: 'Light Rail Blue Line to downtown',            rideshare: 'Uber ~$25–40 downtown' },
  KDEN: { transit: 'A Line train to Union Station (37 min)',      rideshare: 'Uber ~$45–65 to Denver' },
  KPHX: { transit: 'Sky Train + Light Rail',                       rideshare: 'Uber ~$20–35 to Phoenix' },
  KPHL: { transit: 'SEPTA Airport Line to Center City (~25 min)', rideshare: 'Uber ~$25–35 to Center City' },
  KSAN: { transit: 'MTS Trolley extension to downtown',            rideshare: 'Uber ~$20–30 to downtown' },
  CYYZ: { transit: 'UP Express to Union Station (25 min)',         rideshare: 'Uber ~$60–80 CAD downtown' },
  CYUL: { transit: 'REM train (new) — fast to downtown',           rideshare: 'Uber ~$40–55 CAD downtown' },
  CYVR: { transit: 'Canada Line SkyTrain to downtown (~26 min)',   rideshare: 'Uber ~$30–45 CAD downtown' },
  MMMX: { transit: 'Metro Line 5 (basic) — Metrobús cleaner',      rideshare: 'Uber works very well in CDMX' },

  // Europe
  EGLL: { transit: 'Elizabeth Line or Heathrow Express',          rideshare: '£60–90 in an Uber to central' },
  EGKK: { transit: 'Gatwick Express to Victoria (30 min)',         rideshare: '£70–100 to central London' },
  EGCC: { transit: 'Train direct to Manchester Piccadilly',         rideshare: '£20–30 to city centre' },
  LFPG: { transit: 'RER B straight into Paris',                     rideshare: '€55–75 fixed fare to right bank' },
  EDDF: { transit: 'S-Bahn S8/S9 — Hauptbahnhof in 12 min',         rideshare: '€30–45 taxi to centre' },
  EHAM: { transit: 'Train direct to Amsterdam Centraal (15 min)',   rideshare: '€40–55 Uber to centre' },
  LIRF: { transit: 'Leonardo Express to Termini (32 min)',          rideshare: '€50 fixed taxi to centre' },
  LEMD: { transit: 'Metro Line 8 to Nuevos Ministerios (20 min)',   rideshare: '€30 fixed taxi to centre' },
  LSZH: { transit: 'Train to Hauptbahnhof — 12 min, every 10 min',  rideshare: 'CHF 60–80 to centre' },
  LOWW: { transit: 'CAT (16 min) or S7 (cheaper, 25 min)',          rideshare: '€35–45 to centre' },
  ESSA: { transit: 'Arlanda Express to Central (18 min)',           rideshare: 'SEK 500–650 to centre' },
  EKCH: { transit: 'Metro M2 — runs 24/7, 13 min to centre',         rideshare: 'DKK 250–350 taxi to centre' },
  LEBL: { transit: 'L9 Sud metro or Aerobús to plaça Catalunya',     rideshare: '€30–40 to centre' },
  EDDM: { transit: 'S-Bahn S1/S8 to Hauptbahnhof (~40 min)',         rideshare: '€60–80 to centre' },

  // Asia / Pacific
  RJTT: { transit: 'Keikyu Line to Shinagawa, then JR',              rideshare: '¥6000–9000 taxi — train is way better' },
  RJAA: { transit: "Narita Express (N'EX) or Skyliner",              rideshare: '¥20000+ taxi — please take the train' },
  ZBAA: { transit: 'Airport Express to Dongzhimen',                  rideshare: 'Didi works, traffic dependent' },
  ZSPD: { transit: 'Maglev + Metro 2 — actually fast and fun',       rideshare: 'Didi, but Maglev is iconic' },
  RKSI: { transit: 'AREX express to Seoul Station (43 min)',         rideshare: 'Limousine bus is the rideshare alternative' },
  WSSS: { transit: 'MRT to anywhere in the city',                     rideshare: 'Grab is excellent here' },
  VHHH: { transit: 'Airport Express to Central — 24 min',             rideshare: 'Taxi or Uber, traffic in tunnels' },
  VTBS: { transit: 'Airport Rail Link to Phaya Thai',                 rideshare: 'Grab/Bolt, traffic-permitting' },
  VABB: { transit: '(Mumbai Metro line under construction)',          rideshare: 'Uber/Ola or pre-paid taxi' },
  VIDP: { transit: 'Airport Express Metro to New Delhi (22 min)',     rideshare: 'Uber/Ola' },
  VOMM: { transit: 'Suburban rail or Metro extension',                rideshare: 'Uber/Ola is most reliable' },
  VOBL: { transit: 'Vayu Vajra (BMTC bus) — slower but cheap',         rideshare: 'Uber/Ola — traffic is the wildcard' },
  VOHS: { transit: 'Pushpak bus or Metro feeder',                      rideshare: 'Uber/Ola is the easy option' },
  YSSY: { transit: 'Airport Link train to Central (~13 min)',          rideshare: 'Uber AUD 50–70 to CBD' },
  YMML: { transit: 'SkyBus to Southern Cross — every 10 min',          rideshare: 'Uber AUD 60–80 to CBD' },
  NZAA: { transit: 'SkyBus to city — runs frequently',                 rideshare: 'Uber NZD 70–90 to CBD' },
};

/** Compose a transport-advice note based on time of day, weather, and the
 *  arrival airport. Local time is approximated from longitude (good enough
 *  for "rush hour or not"). */
function transportNote({ icao, lat, lon, weather }) {
  // Approximate destination local time from longitude
  const offsetHours = Math.round(lon / 15);
  const utcNow      = new Date();
  const localHour   = (utcNow.getUTCHours() + offsetHours + 24) % 24;
  const day         = (utcNow.getUTCDay() + (utcNow.getUTCHours() + offsetHours >= 24 ? 1 : 0)) % 7;
  const isWeekend   = day === 0 || day === 6;

  let period;
  if      (localHour < 5)  period = 'late-night';
  else if (localHour < 9)  period = 'morning';
  else if (localHour < 12) period = 'midday';
  else if (localHour < 17) period = 'afternoon';
  else if (localHour < 20) period = 'evening';
  else                      period = 'late-evening';

  const isRushHour = !isWeekend && (
    (localHour >= 7 && localHour <= 9) ||
    (localHour >= 16 && localHour <= 19)
  );

  const weatherCode = weather && typeof weather.weather_code === 'number' ? weather.weather_code : null;
  const isRain  = weatherCode != null && (
    (weatherCode >= 51 && weatherCode <= 67) ||
    (weatherCode >= 80 && weatherCode <= 82)
  );
  const isSnow  = weatherCode != null && (
    (weatherCode >= 71 && weatherCode <= 77) ||
    (weatherCode >= 85 && weatherCode <= 86)
  );
  const isStorm = weatherCode != null && weatherCode >= 95;

  const known = AIRPORT_TRANSIT[icao];
  let opening = '';
  if      (period === 'late-night')   opening = 'Late-night arrival';
  else if (period === 'late-evening') opening = 'Evening arrival';
  else if (isRushHour)                opening = `${period} rush hour`;
  else if (period === 'morning')      opening = 'Morning arrival';
  else if (period === 'midday')       opening = 'Midday arrival';
  else if (period === 'afternoon')    opening = 'Afternoon arrival';
  else                                opening = 'Arriving';

  let rec;
  if (known) {
    if (isRushHour && known.transit && known.transit[0] !== '(') {
      rec = `take the ${known.transit.toLowerCase()}, it'll beat the traffic`;
    } else if (period === 'late-night' || period === 'late-evening') {
      rec = `${known.rideshare.toLowerCase()} is probably the easiest at this hour`;
    } else if (isRain || isSnow || isStorm) {
      rec = `the ${known.transit.toLowerCase()} keeps her dry, otherwise ${known.rideshare.toLowerCase()}`;
    } else {
      rec = `${known.transit.toLowerCase()} or ${known.rideshare.toLowerCase()} both work`;
    }
  } else {
    if (isRushHour) {
      rec = "give the road extra time, or look for an airport train if there is one";
    } else if (period === 'late-night') {
      rec = 'a rideshare is the safe bet at this hour';
    } else if (isRain || isSnow || isStorm) {
      rec = 'covered transit beats waiting for a cab in this weather';
    } else {
      rec = 'should be a smooth ride home';
    }
  }

  return `${opening} — ${rec}.`;
}

/** Cute formatter for local-time line shown in the arrival card header. */
function formatLocalTime(lat, lon) {
  const offsetHours = Math.round(lon / 15);
  const utcNow = new Date();
  const localMs = utcNow.getTime() + offsetHours * 3600 * 1000;
  const local   = new Date(localMs);
  // We use UTC getters because we already added the offset
  const hh = local.getUTCHours().toString().padStart(2, '0');
  const mm = local.getUTCMinutes().toString().padStart(2, '0');
  const sign = offsetHours >= 0 ? '+' : '';
  return `local time ${hh}:${mm} (UTC${sign}${offsetHours})`;
}

/** Pull weather, render it + the transport note into the arrival card.
 *  Called once when route is established and again every 10 minutes via
 *  state.weatherTimer. Hides the card if there's no destination. */
async function refreshArrivalCard() {
  const route = state.currentRoute;
  if (!route || !route.to || route.to.lat == null || route.to.lon == null) {
    if (els.arrivalCard) els.arrivalCard.hidden = true;
    return;
  }
  const dest = route.to;
  els.arrivalCity.textContent      = dest.city || dest.name || (dest.iata || dest.icao || '—');
  els.arrivalLocalTime.textContent = formatLocalTime(dest.lat, dest.lon);
  els.arrivalCard.hidden = false;

  // Fetch weather (Open-Meteo). On failure, hide the weather block but keep the card.
  try {
    const w = await fetchDestinationWeather(dest.lat, dest.lon);
    if (!w) throw new Error('no weather data');
    state.lastWeather = w;
    const [label, glyph] = decodeWeather(w.weather_code, w.is_day);
    els.weatherIcon.textContent = glyph;
    els.weatherTemp.textContent = `${Math.round(w.temperature_2m)}°`;
    els.weatherCond.textContent = label;
    const pieces = [];
    if (typeof w.apparent_temperature === 'number') pieces.push(`feels like ${Math.round(w.apparent_temperature)}°`);
    if (typeof w.wind_speed_10m       === 'number') pieces.push(`wind ${Math.round(w.wind_speed_10m)} mph`);
    els.weatherDetail.textContent = pieces.join(' · ');
    els.weatherNote.textContent = whatToWear(
      w.temperature_2m, w.weather_code, w.wind_speed_10m, CONFIG.partnerName
    );
  } catch (e) {
    console.warn('[skyward] weather fetch failed:', e.message);
    els.weatherIcon.textContent = '·';
    els.weatherTemp.textContent = '—';
    els.weatherCond.textContent = 'weather unavailable';
    els.weatherDetail.textContent = '';
    els.weatherNote.textContent = '';
  }

  // Transport advice (always available, uses last-known weather if any)
  els.transportNote.textContent = transportNote({
    icao:    dest.icao,
    lat:     dest.lat,
    lon:     dest.lon,
    weather: state.lastWeather,
  });
}

/** ac is an adsb.lol aircraft object. */
function renderStats(ac, route) {
  const altFt    = numOrNull(ac.alt_geom) ?? numOrNull(ac.alt_baro);
  const speedKt  = numOrNull(ac.gs);
  const heading  = numOrNull(ac.track);
  const lat      = numOrNull(ac.lat);
  const lon      = numOrNull(ac.lon);
  const callsign = (ac.flight || '').trim();

  els.callsignBadge.textContent = callsign || '—';
  els.statAltitude.innerHTML = altFt != null
    ? `${formatFt(altFt)} <span class="unit">ft</span>` : '— <span class="unit">ft</span>';
  els.statSpeed.innerHTML = speedKt != null
    ? `${formatMphFromKt(speedKt)} <span class="unit">mph</span>` : '— <span class="unit">mph</span>';
  els.statHeading.innerHTML = heading != null
    ? `${Math.round(heading)} <span class="unit">°</span>` : '— <span class="unit">°</span>';
  els.statOrigin.textContent = (route && route.from)
    ? `${route.from.city} ${route.from.iata}` : '—';

  if (route && route.from && route.to && lat != null && lon != null) {
    els.fromAirport.textContent = `${route.from.city} ${route.from.iata}`.trim();
    els.toAirport.textContent   = `${route.to.city} ${route.to.iata}`.trim();
    els.progressFromCode.textContent = route.from.iata || route.from.icao || '—';
    els.progressToCode.textContent   = route.to.iata   || route.to.icao   || '—';

    const totalKm     = haversineKm(route.from.lat, route.from.lon, route.to.lat, route.to.lon);
    const flownKm     = haversineKm(route.from.lat, route.from.lon, lat, lon);
    const remainingKm = Math.max(0, totalKm - flownKm);
    const pct         = Math.min(100, Math.max(0, (flownKm / totalKm) * 100));

    els.progressFill.style.width  = `${pct}%`;
    els.progressPlane.style.left  = `${pct}%`;
    els.progressPercent.textContent = `${pct.toFixed(0)}%`;
    els.distFlown.textContent     = `${formatKm(flownKm)} flown`;
    els.distRemaining.textContent = `${formatKm(remainingKm)} to go`;

    // Compute departure & arrival times (best-effort, based on speed + progress)
    const timing = computeTiming(speedKt, flownKm, remainingKm);

    if (timing.arriveText) {
      els.etaValue.textContent = timing.arriveText;
      const departLine = timing.departText ? `departed ${timing.departText} · ` : '';
      els.etaSub.textContent   = `${departLine}~${timing.remainingHuman} left · landing in ${route.to.city}`;
    } else {
      els.etaValue.textContent = '—';
      els.etaSub.textContent   = `landing in ${route.to.city}`;
    }

    // Push timing into the permanent map labels so they stay in sync as the flight progresses
    updateRouteLabels(route.from, route.to, timing);

    els.loveNoteText.textContent = makeLoveNote({ altFt, route, flownKm, remainingKm, pct });
  } else {
    els.fromAirport.textContent = '—';
    els.toAirport.textContent   = '—';
    els.progressFromCode.textContent = '—';
    els.progressToCode.textContent   = '—';
    els.progressFill.style.width = '0%';
    els.progressPlane.style.left = '0%';
    els.progressPercent.textContent = '—';
    els.distFlown.textContent = '—';
    els.distRemaining.textContent = '—';
    els.etaValue.textContent = '—';
    els.etaSub.textContent   = 'route data unavailable — showing live position only';
    els.loveNoteText.textContent = altFt
      ? `${CONFIG.partnerName} is cruising at ${formatFt(altFt)} ft — somewhere up there.`
      : `${CONFIG.partnerName} is currently airborne. We've got eyes on the radar.`;
  }
}

function makeLoveNote({ altFt, route, flownKm, remainingKm, pct }) {
  const name = CONFIG.partnerName;
  if (pct > 92) return `Almost there. ${name} is descending into ${route.to.city} — go meet her at the gate.`;
  if (pct > 70) return `${name}'s on the home stretch — only ${formatKm(remainingKm)} between you.`;
  if (pct > 40) return `Halfway. ${name} is cruising at ${formatFt(altFt)} ft, somewhere over the world.`;
  if (pct > 15) return `${name} has found her altitude. Window seat or aisle?`;
  if (pct > 2)  return `Just took off. ${name} is climbing — the city falling away below.`;
  return `Wheels up. ${name}'s flight has begun.`;
}

/* ─────────────────────────────────────────
   Section visibility / errors
   ───────────────────────────────────────── */
function showOnly(section /* hero | tracker | loading | error */) {
  els.hero.hidden    = section !== 'hero';
  els.tracker.hidden = section !== 'tracker';
  els.loading.hidden = section !== 'loading';
  els.error.hidden   = section !== 'error';
}
function showError(title, sub) {
  els.errorTitle.textContent = title;
  els.errorSub.textContent   = sub || '';
  showOnly('error');
}

/* ─────────────────────────────────────────
   Search → Track flow
   ───────────────────────────────────────── */
async function trackFlight(rawInput) {
  const flight = normalizeFlight(rawInput);
  if (!flight) return;

  pushRecent(flight);
  showOnly('loading');

  // Stop any in-flight animation/poll from the previous track
  stopAnimation();
  if (state.refreshTimer) { clearInterval(state.refreshTimer); state.refreshTimer = null; }
  if (state.weatherTimer) { clearInterval(state.weatherTimer); state.weatherTimer = null; }
  state.lastFix = null;
  state.lastWeather = null;
  if (els.arrivalCard) els.arrivalCard.hidden = true;

  const candidates = flightToCallsigns(flight);
  if (!candidates.length) {
    showError("That doesn't look like a flight number.",
              'Try something like BA286, AA100, or LH441.');
    return;
  }

  // Step 1: find a callsign that returns at least one airborne aircraft.
  let aircraftList = [], usedCallsign = null, lastErr = null;
  for (const cs of candidates) {
    try {
      const list = await fetchAircraftListByCallsign(cs);
      if (list.length) { aircraftList = list; usedCallsign = cs; break; }
    } catch (err) { lastErr = err; }
  }

  if (!aircraftList.length) {
    if (lastErr) {
      console.error('[skyward] all callsign lookups failed:', lastErr);
      showError('Radar is offline right now.',
                "Couldn't reach the live tracking network. Try again in a minute. (Open the browser console for details.)");
    } else {
      showError(`Couldn't find ${flight} in the air right now.`,
                "She might be on the ground, just landed, or outside our radar window. Try again in a few minutes.");
    }
    return;
  }

  // Step 2: pick a probable aircraft from the candidates. With no route info
  // yet this is just "first exact callsign match," but it gives us a position
  // to feed into the route lookup so adsb.lol can plausibility-check.
  let aircraft = pickBestAircraft(aircraftList, null);

  // Step 3: look up the route. adsb.lol's /api/0/routeset is the canonical
  // source and matches what the adsb.lol website shows. Whatever it returns,
  // we trust — even if `plausible:false` — because the website behaves the
  // same way and the user is comparing against the website.
  const lookupCallsign = (aircraft.flight || usedCallsign || '').trim();
  const route = await fetchRouteByCallsign(lookupCallsign, aircraft.lat, aircraft.lon);

  // Step 4: when multiple aircraft share a callsign, re-pick using the route
  // to get the best-fit one. (No-op if list has just one.)
  if (route && aircraftList.length > 1) {
    aircraft = pickBestAircraft(aircraftList, route);
  }

  // Step 5: route is already verified inside fetchRouteByCallsign (which
  // queries multiple sources and picks the one most consistent with the
  // aircraft's actual position). Just commit it to state.
  state.currentRoute    = route;
  state.currentCallsign = (aircraft.flight || usedCallsign || '').trim();
  state.currentIcao24   = aircraft.hex;

  // Map setup
  showOnly('tracker');
  ensureMap();
  setTimeout(() => state.map.invalidateSize(), 50);
  clearMapLayers();

  // Draw the route line + permanent labels (timing fills in via renderStats below)
  if (state.currentRoute) {
    renderRoute(state.currentRoute.from, state.currentRoute.to);
  }

  // Frame the map around origin/destination/plane so everything is visible
  fitMapToFlight(state.currentRoute?.from, state.currentRoute?.to, aircraft.lat, aircraft.lon);

  // Snap to the first real fix and start the animation loop. The loop
  // dead-reckons the plane forward every second so the map looks alive
  // between 30s API polls.
  applyAircraftUpdate(aircraft);
  startAnimation();
  state.refreshTimer = setInterval(refreshLivePosition, CONFIG.refreshMs);

  // Pull weather + transport for the destination once now, then on a slow
  // 10-minute cadence (Open-Meteo updates roughly every 15 min anyway).
  refreshArrivalCard();
  state.weatherTimer = setInterval(() => {
    refreshArrivalCard().catch(err => {
      console.warn('[skyward] weather refresh tick threw — recovering:', err);
    });
  }, CONFIG.weatherRefreshMs);
}

/* ─────────────────────────────────────────
   Live-position machinery
   ─────────────────────────────────────────
   Two timers run while a flight is being tracked:
     • refreshTimer (30s) — hits adsb.lol for a fresh authoritative fix
     • animationTimer (1s) — dead-reckons position forward along heading
   The ground speed reported by ADS-B is true ground speed, so projecting
   forward at that speed gives a very close approximation of the real path
   between API hits. Each real fix snaps the plane to ground truth. */

function applyAircraftUpdate(ac) {
  state.lastFix = {
    lat:        ac.lat,
    lon:        ac.lon,
    speedKt:    numOrNull(ac.gs),
    headingDeg: numOrNull(ac.track),
    altFt:      numOrNull(ac.alt_geom) ?? numOrNull(ac.alt_baro),
    time:       Date.now(),
    raw:        ac,                                  // keep for renderStats
  };
  renderFromFix();
}

function renderFromFix() {
  const fix = state.lastFix;
  if (!fix) return;

  // Step 1: dead-reckon the plane forward from its last real fix
  let curLat = fix.lat, curLon = fix.lon;
  if (fix.speedKt != null && fix.speedKt > 30 && fix.headingDeg != null) {
    const elapsedSec = (Date.now() - fix.time) / 1000;
    const speedKmh   = fix.speedKt * 1.852;
    const distanceKm = speedKmh * (elapsedSec / 3600);
    if (distanceKm > 0.02) {
      [curLat, curLon] = projectByBearing(fix.lat, fix.lon, fix.headingDeg, distanceKm);
    }
  }

  // Keep the actual position so renderStats has truthful flown/remaining math
  const actualLat = curLat, actualLon = curLon;

  // Step 2: when we have a route, snap the plane onto the dashed great-circle
  // line so the visual stays clean — one path, plane gliding along it. Heading
  // becomes the path's tangent at that point so the icon points correctly.
  let displayHeading = fix.headingDeg;
  if (state.currentRoute && state.currentRoute.from && state.currentRoute.to) {
    const snap = snapToRoute(state.currentRoute, actualLat, actualLon);
    if (snap) {
      curLat = snap.lat;
      curLon = snap.lon;
      if (snap.bearing != null) displayHeading = snap.bearing;
    }
  }

  renderPlane(curLat, curLon, displayHeading);

  // No solid flown line anymore — just the dashed route + the moving plane.

  // renderStats uses the *actual* (not snapped) position for accurate progress
  const synthetic = { ...fix.raw, lat: actualLat, lon: actualLon };
  renderStats(synthetic, state.currentRoute);

  setUpdated((Date.now() - fix.time) / 1000);
}

/** Map an aircraft's actual lat/lon to a point along the great-circle route
 *  from origin to destination, based on flown-distance ratio. Also returns
 *  the path's bearing at that point so the plane icon can be oriented along
 *  the line rather than at its raw heading. */
function snapToRoute(route, lat, lon) {
  if (!route || !route.from || !route.to) return null;
  if (!validCoord(route.from.lat, route.from.lon) ||
      !validCoord(route.to.lat,   route.to.lon)   ||
      !validCoord(lat, lon)) return null;

  const totalKm = haversineKm(route.from.lat, route.from.lon, route.to.lat, route.to.lon);
  if (!totalKm || totalKm <= 0) return null;
  const flownKm = haversineKm(route.from.lat, route.from.lon, lat, lon);
  const ratio   = Math.min(1, Math.max(0, flownKm / totalKm));
  if (!Number.isFinite(ratio)) return null;

  const path = greatCirclePath(route.from.lat, route.from.lon,
                               route.to.lat,   route.to.lon, 256);
  if (!path.length) return null;
  const idx   = Math.min(path.length - 1, Math.max(0, Math.floor(ratio * (path.length - 1))));
  const here  = path[idx];
  const next  = path[Math.min(idx + 1, path.length - 1)];
  if (!here || !validCoord(here[0], here[1])) return null;

  const bearing = (here !== next && next && validCoord(next[0], next[1]))
    ? bearingDeg(here[0], here[1], next[0], next[1])
    : null;
  return { lat: here[0], lon: here[1], bearing };
}

function startAnimation() {
  stopAnimation();
  // Wrap the tick so a thrown exception in one frame can't poison the
  // setInterval and freeze the live update forever.
  state.animationTimer = setInterval(() => {
    try {
      renderFromFix();
    } catch (err) {
      console.warn('[skyward] render tick threw — recovering:', err);
    }
  }, 1000);
}
function stopAnimation() {
  if (state.animationTimer) {
    clearInterval(state.animationTimer);
    state.animationTimer = null;
  }
}

async function refreshLivePosition() {
  if (!state.currentCallsign) return;
  try {
    const list = await fetchAircraftListByCallsign(state.currentCallsign);
    const ac   = pickBestAircraft(list, state.currentRoute);
    if (!ac || ac.lat == null || ac.lon == null) {
      els.lastUpdated.textContent = 'no recent position';
      return;
    }
    applyAircraftUpdate(ac);
  } catch (err) {
    console.warn('[skyward] live refresh failed:', err.message);
  }
}

/* ─────────────────────────────────────────
   Wire up events (defensively)
   ───────────────────────────────────────── */
function safeOn(el, type, handler) {
  if (!el) return;
  try { el.addEventListener(type, handler); } catch (e) { console.warn('listener', type, e); }
}

safeOn(els.form, 'submit', (e) => {
  e.preventDefault();
  trackFlight(els.input.value);
});

/* ─────────────────────────────────────────
   Boot
   ───────────────────────────────────────── */
loadStored();
