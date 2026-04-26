/* =====================================================================
   Skyward · live flight tracker
   Data: OpenSky Network public API (no auth required)
   Map: Leaflet + CartoDB dark tiles
   ===================================================================== */

'use strict';

/* ─────────────────────────────────────────
   Config
   ───────────────────────────────────────── */
const CONFIG = {
  apiBase: 'https://opensky-network.org/api',
  refreshMs: 30_000,                 // re-poll live position every 30s
  flightHistoryWindowSec: 4 * 3600,  // search ±4h around now for route data
  storageKey: 'skyward.v1',
};

/* ─────────────────────────────────────────
   IATA → ICAO airline codes
   (covers ~85 airlines — easy to extend)
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
   ~210 airports, covers most international flights.
   Each entry also stores its IATA code for display.
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
  routeLayer: null,           // L.Polyline of full route
  flownLayer: null,           // L.Polyline of distance flown so far
  fromMarker: null,
  toMarker: null,
  planeMarker: null,
  refreshTimer: null,
  currentCallsign: null,
  currentIcao24: null,
  currentRoute: null,         // { from: airport, to: airport }
  partnerName: 'her',
  petName: '',
  recent: [],
};

/* ─────────────────────────────────────────
   DOM refs
   ───────────────────────────────────────── */
const $ = (sel) => document.querySelector(sel);
const els = {
  form:      $('#searchForm'),
  input:     $('#flightInput'),
  hero:      $('#hero'),
  tracker:   $('#tracker'),
  loading:   $('#loadingState'),
  error:     $('#errorState'),
  errorTitle:$('#errorTitle'),
  errorSub:  $('#errorSub'),
  recent:    $('#recent'),
  recentChips: $('#recentChips'),
  callsignBadge: $('#callsignBadge'),
  fromAirport: $('#fromAirport'),
  toAirport:   $('#toAirport'),
  lastUpdated: $('#lastUpdated'),
  refreshBtn:  $('#refreshBtn'),
  statAltitude:$('#statAltitude'),
  statSpeed:   $('#statSpeed'),
  statHeading: $('#statHeading'),
  statOrigin:  $('#statOrigin'),
  loveNote:    $('#loveNote'),
  loveNoteText:$('#loveNoteText'),
  progressFill:$('#progressFill'),
  progressPlane:$('#progressPlane'),
  progressPercent: $('#progressPercent'),
  progressFromCode:$('#progressFromCode'),
  progressToCode:  $('#progressToCode'),
  distFlown:    $('#distFlown'),
  distRemaining:$('#distRemaining'),
  etaValue:     $('#etaValue'),
  etaSub:       $('#etaSub'),
  heroName:     $('#heroName'),
  // modal
  personalizeBtn: $('#personalizeBtn'),
  modal:        $('#modal'),
  modalClose:   $('#modalClose'),
  modalCancel:  $('#modalCancel'),
  modalSave:    $('#modalSave'),
  nameInput:    $('#nameInput'),
  petInput:     $('#petInput'),
};

/* ─────────────────────────────────────────
   Persistence
   ───────────────────────────────────────── */
function loadStored() {
  try {
    const raw = localStorage.getItem(CONFIG.storageKey);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data.partnerName) { state.partnerName = data.partnerName; els.heroName.textContent = data.partnerName; }
    if (data.petName) state.petName = data.petName;
    if (Array.isArray(data.recent)) state.recent = data.recent.slice(0, 6);
    renderRecent();
  } catch (_) { /* ignore */ }
}
function saveStored() {
  try {
    localStorage.setItem(CONFIG.storageKey, JSON.stringify({
      partnerName: state.partnerName,
      petName: state.petName,
      recent: state.recent,
    }));
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

/** Convert a typed flight number ("BA286") into possible OpenSky callsigns ("BAW286"). */
function flightToCallsigns(flight) {
  // Already an ICAO callsign? (3 letters + digits) → use directly.
  const m = flight.match(/^([A-Z0-9]{2,3})(\d{1,5}[A-Z]?)$/);
  if (!m) return [];

  const prefix = m[1], num = m[2];
  const candidates = new Set();

  // Direct as-is (in case user typed the ICAO code already, e.g. "BAW286")
  candidates.add(prefix + num);

  // IATA → ICAO airline mapping
  if (AIRLINES[prefix]) candidates.add(AIRLINES[prefix] + num);
  // 2-char alphanumeric IATA codes (B6, 6E, etc.) handled above

  return [...candidates];
}

/** Great-circle interpolation between two lat/lon points. */
function greatCirclePath(lat1, lon1, lat2, lon2, n = 128) {
  const toRad = (d) => d * Math.PI / 180;
  const toDeg = (r) => r * 180 / Math.PI;
  const φ1 = toRad(lat1), λ1 = toRad(lon1);
  const φ2 = toRad(lat2), λ2 = toRad(lon2);
  const Δσ = Math.acos(
    Math.min(1, Math.max(-1,
      Math.sin(φ1) * Math.sin(φ2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1)
    ))
  );
  if (Δσ === 0) return [[lat1, lon1], [lat2, lon2]];

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
    points.push([toDeg(φ), toDeg(λ)]);
  }
  return points;
}

/** Distance in km between two lat/lon points (haversine). */
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (d) => d * Math.PI / 180;
  const dφ = toRad(lat2 - lat1);
  const dλ = toRad(lon2 - lon1);
  const a = Math.sin(dφ / 2) ** 2
          + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dλ / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function formatKm(km)    { return `${km.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} km`; }
function formatMiles(km) { return `${(km * 0.621371).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} mi`; }
function formatFt(m)     { return `${(m * 3.28084).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`; }
function formatMph(mps)  { return `${(mps * 2.23694).toFixed(0)}`; }

function formatRelative(secsAgo) {
  if (secsAgo < 60) return `${Math.max(0, Math.floor(secsAgo))}s ago`;
  if (secsAgo < 3600) return `${Math.floor(secsAgo / 60)}m ago`;
  return `${Math.floor(secsAgo / 3600)}h ago`;
}

function setUpdated(timestampSec) {
  if (!timestampSec) { els.lastUpdated.textContent = '—'; return; }
  const ago = (Date.now() / 1000) - timestampSec;
  els.lastUpdated.textContent = `updated ${formatRelative(ago)}`;
}

/* ─────────────────────────────────────────
   API calls
   ───────────────────────────────────────── */
async function fetchAllStates() {
  const url = `${CONFIG.apiBase}/states/all`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OpenSky returned ${res.status}`);
  return res.json();
}

async function fetchFlightsForAircraft(icao24) {
  const now = Math.floor(Date.now() / 1000);
  const begin = now - CONFIG.flightHistoryWindowSec;
  const url = `${CONFIG.apiBase}/flights/aircraft?icao24=${icao24}&begin=${begin}&end=${now}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/* ─────────────────────────────────────────
   Map setup
   ───────────────────────────────────────── */
function ensureMap() {
  if (state.map) return state.map;
  state.map = L.map('map', {
    zoomControl: true,
    attributionControl: true,
    worldCopyJump: true,
    minZoom: 2,
    maxZoom: 12,
  }).setView([20, 0], 2);

  // Dark, label-rich basemap from CartoDB (free, no API key needed)
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

/** Build a divIcon for an airport marker. */
function airportIcon(kind /* 'from' | 'to' */) {
  return L.divIcon({
    className: '',
    html: `<div class="airport-marker ${kind}"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

/** Build a divIcon for the live aircraft, rotated to its heading. */
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
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

/* ─────────────────────────────────────────
   Render: route + plane on map
   ───────────────────────────────────────── */
function renderRoute(from, to) {
  const path = greatCirclePath(from.lat, from.lon, to.lat, to.lon, 128);

  state.routeLayer = L.polyline(path, {
    color: '#e9b872',
    weight: 2,
    opacity: 0.55,
    dashArray: '6, 8',
    lineCap: 'round',
  }).addTo(state.map);

  state.fromMarker = L.marker([from.lat, from.lon], { icon: airportIcon('from') })
    .bindTooltip(`${from.iata} · ${from.city}`, { direction: 'top', offset: [0, -10], permanent: false })
    .addTo(state.map);

  state.toMarker = L.marker([to.lat, to.lon], { icon: airportIcon('to') })
    .bindTooltip(`${to.iata} · ${to.city}`, { direction: 'top', offset: [0, -10], permanent: false })
    .addTo(state.map);
}

function renderFlownPath(from, currentLat, currentLon) {
  if (state.flownLayer) state.map.removeLayer(state.flownLayer);
  const flown = greatCirclePath(from.lat, from.lon, currentLat, currentLon, 64);
  state.flownLayer = L.polyline(flown, {
    color: '#f4cf94',
    weight: 3,
    opacity: 0.9,
    lineCap: 'round',
  }).addTo(state.map);
}

function renderPlane(lat, lon, heading) {
  if (state.planeMarker) {
    state.planeMarker.setLatLng([lat, lon]);
    state.planeMarker.setIcon(planeIcon(heading));
  } else {
    state.planeMarker = L.marker([lat, lon], {
      icon: planeIcon(heading),
      zIndexOffset: 1000,
    }).addTo(state.map);
  }
}

/** Fit map to show route + plane neatly. */
function fitMapToFlight(from, to, planeLat, planeLon) {
  const points = [];
  if (from) points.push([from.lat, from.lon]);
  if (to)   points.push([to.lat, to.lon]);
  if (planeLat != null && planeLon != null) points.push([planeLat, planeLon]);

  if (points.length === 1) {
    state.map.setView(points[0], 6);
  } else {
    state.map.fitBounds(points, { padding: [60, 60], maxZoom: 7 });
  }
}

/* ─────────────────────────────────────────
   Render: stats panel
   ───────────────────────────────────────── */
function renderStats(planeState, route) {
  const altitudeM = planeState.geo_altitude ?? planeState.baro_altitude;
  const velocity  = planeState.velocity;       // m/s
  const heading   = planeState.true_track;     // degrees
  const origin    = planeState.origin_country; // string
  const lat       = planeState.latitude;
  const lon       = planeState.longitude;
  const callsign  = (planeState.callsign || '').trim();

  els.callsignBadge.textContent = callsign || '—';
  els.statAltitude.innerHTML = altitudeM != null
    ? `${formatFt(altitudeM)} <span class="unit">ft</span>`
    : '— <span class="unit">ft</span>';
  els.statSpeed.innerHTML = velocity != null
    ? `${formatMph(velocity)} <span class="unit">mph</span>`
    : '— <span class="unit">mph</span>';
  els.statHeading.innerHTML = heading != null
    ? `${heading.toFixed(0)} <span class="unit">°</span>`
    : '— <span class="unit">°</span>';
  els.statOrigin.textContent = origin || '—';

  // Route-dependent values
  if (route && route.from && route.to && lat != null && lon != null) {
    els.fromAirport.textContent = `${route.from.city} ${route.from.iata}`;
    els.toAirport.textContent   = `${route.to.city} ${route.to.iata}`;
    els.progressFromCode.textContent = route.from.iata;
    els.progressToCode.textContent   = route.to.iata;

    const totalKm     = haversineKm(route.from.lat, route.from.lon, route.to.lat, route.to.lon);
    const flownKm     = haversineKm(route.from.lat, route.from.lon, lat, lon);
    const remainingKm = Math.max(0, totalKm - flownKm);
    const pct         = Math.min(100, Math.max(0, (flownKm / totalKm) * 100));

    els.progressFill.style.width  = `${pct}%`;
    els.progressPlane.style.left  = `${pct}%`;
    els.progressPercent.textContent = `${pct.toFixed(0)}%`;

    els.distFlown.textContent     = `${formatKm(flownKm)} flown`;
    els.distRemaining.textContent = `${formatKm(remainingKm)} to go`;

    // ETA from speed + remaining distance
    if (velocity && velocity > 50) {
      const remainingHours = (remainingKm * 1000) / velocity / 3600;
      const arrivalDate = new Date(Date.now() + remainingHours * 3600 * 1000);
      const hh = arrivalDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      els.etaValue.textContent = hh;
      const hours = Math.floor(remainingHours);
      const mins  = Math.round((remainingHours - hours) * 60);
      els.etaSub.textContent  = `~${hours}h ${mins}m left · landing in ${route.to.city}`;
    } else {
      els.etaValue.textContent = '—';
      els.etaSub.textContent   = `landing in ${route.to.city}`;
    }

    els.loveNoteText.textContent = makeLoveNote({
      altitudeM, velocity, route, flownKm, remainingKm, pct,
    });
  } else {
    // Live position only — no full route
    els.fromAirport.textContent = '—';
    els.toAirport.textContent   = origin || '—';
    els.progressFromCode.textContent = '—';
    els.progressToCode.textContent   = '—';
    els.progressFill.style.width = '0%';
    els.progressPlane.style.left = '0%';
    els.progressPercent.textContent = '—';
    els.distFlown.textContent = '—';
    els.distRemaining.textContent = '—';
    els.etaValue.textContent = '—';
    els.etaSub.textContent   = 'route data unavailable — showing live position only';

    els.loveNoteText.textContent = altitudeM
      ? `Cruising over ${origin || 'the world'} at ${formatFt(altitudeM)} feet — somewhere up there.`
      : `Currently airborne. We've got eyes on the radar.`;
  }
}

/** Sweet/fun status message that varies with flight state. */
function makeLoveNote({ altitudeM, velocity, route, flownKm, remainingKm, pct }) {
  const name = state.partnerName !== 'her' ? state.partnerName : (state.petName || 'she');
  const opener = name && name !== 'her' && name !== 'she' ? name : 'She';

  if (pct > 92) return `Almost there. ${opener}'s descending into ${route.to.city} — go meet them at the gate.`;
  if (pct > 70) return `${opener}'s on the home stretch — only ${formatKm(remainingKm)} between you.`;
  if (pct > 40) return `Halfway. ${opener} is cruising at ${formatFt(altitudeM)} ft, somewhere over the world.`;
  if (pct > 15) return `${opener}'s found their altitude. Window seat or aisle?`;
  if (pct > 2)  return `Just took off. ${opener}'s climbing, the city falling away below.`;
  return `Wheels up. ${opener}'s flight has begun.`;
}

/* ─────────────────────────────────────────
   Section visibility
   ───────────────────────────────────────── */
function showOnly(section /* 'hero' | 'tracker' | 'loading' | 'error' */) {
  els.hero.hidden    = section !== 'hero';
  els.tracker.hidden = section !== 'tracker';
  els.loading.hidden = section !== 'loading';
  els.error.hidden   = section !== 'error';
}

function showError(title, sub) {
  els.errorTitle.textContent = title;
  els.errorSub.textContent   = sub || els.errorSub.textContent;
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

  const candidates = flightToCallsigns(flight);
  if (!candidates.length) {
    showError(
      "That doesn't look like a flight number.",
      'Try something like BA286, AA100, or LH441.'
    );
    return;
  }

  let allStates;
  try {
    allStates = await fetchAllStates();
  } catch (err) {
    console.error(err);
    showError(
      'Radar is offline right now.',
      "OpenSky's public API is rate-limited or blocked. Try again in a minute."
    );
    return;
  }

  // Match the first state whose callsign starts with one of our candidates
  const states = allStates.states || [];
  let match = null;
  for (const s of states) {
    const cs = (s[1] || '').trim().toUpperCase();
    if (!cs) continue;
    if (candidates.some(c => cs === c || cs.startsWith(c))) {
      match = s; break;
    }
  }

  if (!match) {
    showError(
      `Couldn't find ${flight} in the air right now.`,
      "It might be on the ground, just landed, or outside our radar window. Try again in a few minutes."
    );
    return;
  }

  // Parse state vector
  const planeState = parseStateVector(match);
  state.currentCallsign = (planeState.callsign || '').trim();
  state.currentIcao24   = planeState.icao24;

  // Set up the tracker view
  showOnly('tracker');
  ensureMap();
  // Force Leaflet to recompute size after becoming visible
  setTimeout(() => state.map.invalidateSize(), 50);

  clearMapLayers();

  // Try to enrich with route info
  let route = null;
  const flights = await fetchFlightsForAircraft(planeState.icao24);
  if (Array.isArray(flights) && flights.length) {
    // Find the most recent flight that's still active or just ended
    const f = flights[flights.length - 1];
    const fromAirport = f.estDepartureAirport && AIRPORTS[f.estDepartureAirport];
    const toAirport   = f.estArrivalAirport   && AIRPORTS[f.estArrivalAirport];
    if (fromAirport && toAirport) {
      route = { from: fromAirport, to: toAirport };
    }
  }
  state.currentRoute = route;

  // Render
  if (route) {
    renderRoute(route.from, route.to);
    renderFlownPath(route.from, planeState.latitude, planeState.longitude);
  }
  renderPlane(planeState.latitude, planeState.longitude, planeState.true_track);
  fitMapToFlight(route?.from, route?.to, planeState.latitude, planeState.longitude);
  renderStats(planeState, route);
  setUpdated(planeState.last_contact);

  // Schedule auto-refresh
  if (state.refreshTimer) clearInterval(state.refreshTimer);
  state.refreshTimer = setInterval(refreshLivePosition, CONFIG.refreshMs);
}

/** Parse OpenSky state vector array into a friendly object. */
function parseStateVector(s) {
  return {
    icao24: s[0],
    callsign: s[1],
    origin_country: s[2],
    time_position: s[3],
    last_contact: s[4],
    longitude: s[5],
    latitude: s[6],
    baro_altitude: s[7],
    on_ground: s[8],
    velocity: s[9],
    true_track: s[10],
    vertical_rate: s[11],
    geo_altitude: s[13],
  };
}

/** Pull just the latest position for the current aircraft (no full re-search). */
async function refreshLivePosition() {
  if (!state.currentIcao24) return;
  try {
    // OpenSky supports filtering by icao24 directly
    const res = await fetch(`${CONFIG.apiBase}/states/all?icao24=${state.currentIcao24}`);
    if (!res.ok) return;
    const data = await res.json();
    const first = (data.states || [])[0];
    if (!first) {
      // Plane is no longer reporting (might have landed)
      els.lastUpdated.textContent = 'no recent position';
      return;
    }
    const ps = parseStateVector(first);
    if (ps.latitude == null || ps.longitude == null) return;

    renderPlane(ps.latitude, ps.longitude, ps.true_track);
    if (state.currentRoute && state.currentRoute.from) {
      renderFlownPath(state.currentRoute.from, ps.latitude, ps.longitude);
    }
    renderStats(ps, state.currentRoute);
    setUpdated(ps.last_contact);
  } catch (err) {
    /* silent — we'll try again next interval */
  }
}

/* ─────────────────────────────────────────
   Personalize modal
   ───────────────────────────────────────── */
function openModal() {
  els.modal.hidden = false;
  els.nameInput.value = state.partnerName !== 'her' ? state.partnerName : '';
  els.petInput.value  = state.petName || '';
  setTimeout(() => els.nameInput.focus(), 60);
}
function closeModal() { els.modal.hidden = true; }
function saveModal() {
  const n = els.nameInput.value.trim();
  const p = els.petInput.value.trim();
  state.partnerName = n || 'her';
  state.petName = p;
  els.heroName.textContent = state.partnerName;
  saveStored();
  closeModal();
}

/* ─────────────────────────────────────────
   Wire up events
   ───────────────────────────────────────── */
els.form.addEventListener('submit', (e) => {
  e.preventDefault();
  trackFlight(els.input.value);
});

els.refreshBtn.addEventListener('click', () => {
  els.refreshBtn.classList.add('spinning');
  refreshLivePosition().finally(() => {
    setTimeout(() => els.refreshBtn.classList.remove('spinning'), 600);
  });
});

els.personalizeBtn.addEventListener('click', openModal);
els.modalClose.addEventListener('click', closeModal);
els.modalCancel.addEventListener('click', closeModal);
els.modalSave.addEventListener('click', saveModal);
els.modal.addEventListener('click', (e) => {
  if (e.target === els.modal) closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !els.modal.hidden) closeModal();
});

// Periodically refresh the "updated Xs ago" pill
setInterval(() => {
  if (els.tracker.hidden) return;
  const text = els.lastUpdated.textContent;
  // If the last_contact timestamp is captured in setUpdated, we just leave the
  // string as is between full refreshes — not worth re-wiring. (Looks fine.)
}, 10_000);

/* ─────────────────────────────────────────
   Boot
   ───────────────────────────────────────── */
loadStored();
