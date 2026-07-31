// Poblaciones principales por provincia — para el selector del checkout.
// Fuente: INE (Instituto Nacional de Estadística) — municipios más poblados.
// Se usa como control anti-fraude: el cliente SOLO puede elegir de esta lista.

export const POBLACIONES: Record<string, string[]> = {
  "Álava": [
    "Vitoria-Gasteiz","Llodio","Amurrio","Agurain","Zuia","Aramaio",
    "Zuya","Legutio","Oyón","Labastida"
  ],
  "Albacete": [
    "Albacete","Hellín","Villarrobledo","La Roda","Almansa","Caudete",
    "Tobarra","Madrigueras","Tarazona de la Mancha","Munera"
  ],
  "Alicante": [
    "Alicante","Elche","Torrevieja","Orihuela","Benidorm","Alcoy",
    "Elda","San Vicente del Raspeig","Villena","Dénia","Calpe","Jávea",
    "Altea","Santa Pola","Guardamar del Segura","Pilar de la Horadada",
    "Crevillente","Novelda","Aspe","Monóvar"
  ],
  "Almería": [
    "Almería","El Ejido","Roquetas de Mar","Níjar","Huércal-Overa",
    "Vícar","Adra","Berja","El Parador","Cuevas del Almanzora"
  ],
  "Asturias": [
    "Oviedo","Gijón","Avilés","Siero","Langreo","Mieres","Castrillón",
    "San Martín del Rey Aurelio","Corvera de Asturias","Llanera",
    "Villaviciosa","Cangas de Onís","Luarca","Ribadesella"
  ],
  "Ávila": [
    "Ávila","Arévalo","Arenas de San Pedro","El Tiemblo","Candeleda",
    "Las Navas del Marqués","Sotillo de la Adrada","Piedralaves"
  ],
  "Badajoz": [
    "Badajoz","Mérida","Don Benito","Almendralejo","Villanueva de la Serena",
    "Jerez de los Caballeros","Zafra","Montijo","Olivenza","Llerena"
  ],
  "Baleares": [
    "Palma","Calvià","Manacor","Inca","Llucmajor","Marratxí",
    "Santa Eulalia del Río","Ciudadela","Mahon","Eivissa","Sant Antoni de Portmany",
    "Felanitx","Pollença","Sóller","Capdepera","Artà"
  ],
  "Barcelona": [
    "Barcelona","Hospitalet de Llobregat","Badalona","Terrassa","Sabadell",
    "Mataró","Santa Coloma de Gramanet","Cornellà de Llobregat","Sant Boi de Llobregat",
    "Rubí","Manresa","Vilanova i la Geltrú","Vilafranca del Penedès","El Prat de Llobregat",
    "Granollers","Cerdanyola del Vallès","Mollet del Vallès","Sant Cugat del Vallès",
    "Igualada","Vic","Gavà","Esplugues de Llobregat","Sant Feliu de Llobregat",
    "Viladecans","Castelldefels","Sitges","Ripollet","Montcada i Reixac",
    "Sant Adrià de Besòs","Calella","Arenys de Mar","Pineda de Mar","Malgrat de Mar"
  ],
  "Burgos": [
    "Burgos","Miranda de Ebro","Aranda de Duero","Briviesca","Lerma",
    "Villarcayo","Medina de Pomar","Salas de los Infantes"
  ],
  "Cáceres": [
    "Cáceres","Plasencia","Miajadas","Navalmoral de la Mata","Coria",
    "Trujillo","Zafra","Jarandilla de la Vera","Logrosán"
  ],
  "Cádiz": [
    "Cádiz","Jerez de la Frontera","Algeciras","San Fernando","El Puerto de Santa María",
    "Chiclana de la Frontera","Sanlúcar de Barrameda","La Línea de la Concepción",
    "Puerto Real","Arcos de la Frontera","Rota","Ubrique","Barbate",
    "Tarifa","Conil de la Frontera","Vejer de la Frontera"
  ],
  "Cantabria": [
    "Santander","Torrelavega","Camargo","Castro Urdiales","Piélagos",
    "El Astillero","Laredo","Santoña","Reinosa","Los Corrales de Buelna"
  ],
  "Castellón": [
    "Castellón de la Plana","Villarreal","Burriana","Vinaròs","Benicarló",
    "Onda","Almazora","Benicàssim","Nules","Vall de Uxó","Oropesa del Mar",
    "Peñíscola","Alcalà de Xivert"
  ],
  "Ciudad Real": [
    "Ciudad Real","Puertollano","Tomelloso","Alcázar de San Juan","Valdepeñas",
    "Manzanares","La Solana","Daimiel","Miguelturra","Campo de Calatrava"
  ],
  "Córdoba": [
    "Córdoba","Lucena","Puente Genil","Cabra","Montilla","Priego de Córdoba",
    "Palma del Río","Pozoblanco","Baena","Lucena","Villa del Río"
  ],
  "Cuenca": [
    "Cuenca","Tarancón","San Clemente","Mota del Cuervo","Las Pedroñeras",
    "Motilla del Palancar","Iniesta","Quintanar del Rey"
  ],
  "Girona": [
    "Girona","Figueres","Blanes","Lloret de Mar","Salt","Olot",
    "Palafrugell","Ripoll","Sant Feliu de Guíxols","Torroella de Montgrí",
    "Platja d'Aro","Banyoles","La Bisbal d'Empordà","Roses","Empuriabrava"
  ],
  "Granada": [
    "Granada","Motril","Almuñécar","Armilla","Maracena","Baza",
    "Guadix","Loja","Atarfe","Las Gabias","Huejar","Ogíjares",
    "Salobreña","Lanjarón","Alhama de Granada"
  ],
  "Guadalajara": [
    "Guadalajara","Azuqueca de Henares","Alovera","Cabanillas del Campo",
    "Marchamalo","Molina de Aragón","Sigüenza","Pastrana"
  ],
  "Guipúzcoa": [
    "San Sebastián","Irún","Renteria","Eibar","Zarautz","Mondragón",
    "Hernani","Tolosa","Arrasate","Lasarte-Oria","Andoain","Pasaia",
    "Oñati","Azpeitia","Zumarraga","Deba","Getaria"
  ],
  "Huelva": [
    "Huelva","Lepe","Moguer","Almonte","Isla Cristina","Ayamonte",
    "Punta Umbría","Gibraleón","Cartaya","Palos de la Frontera"
  ],
  "Huesca": [
    "Huesca","Barbastro","Monzón","Fraga","Jaca","Sabiñánigo",
    "Graus","Binéfar","Sariñena","Aínsa"
  ],
  "Jaén": [
    "Jaén","Linares","Úbeda","Andújar","Martos","Alcalá la Real",
    "Bailén","La Carolina","Jódar","Torredonjimeno","Baeza"
  ],
  "La Coruña": [
    "A Coruña","Santiago de Compostela","Ferrol","Narón","Oleiros","Arteixo",
    "Carballo","Culleredo","Ribeira","Cambre","Fene","Malpica de Bergantiños",
    "Ordes","Noia","Muros","Vimianzo","Padrón"
  ],
  "La Rioja": [
    "Logroño","Calahorra","Arnedo","Haro","Alfaro","Santo Domingo de la Calzada",
    "Nájera","Lardero","Villamediana de Iregua","Cenicero"
  ],
  "León": [
    "León","Ponferrada","San Andrés del Rabanedo","Villaquilambre","Astorga",
    "La Bañeza","Bembibre","Valencia de Don Juan","Sahagún"
  ],
  "Lleida": [
    "Lleida","Balaguer","Tàrrega","Cervera","La Seu d'Urgell","Solsona",
    "Mollerussa","Les Borges Blanques","Tremp","Agramunt"
  ],
  "Lugo": [
    "Lugo","Monforte de Lemos","Vilalba","Sarria","Viveiro","Foz",
    "Ribadeo","Chantada","Burela","O Vicedo"
  ],
  "Madrid": [
    "Madrid","Móstoles","Alcalá de Henares","Fuenlabrada","Leganés",
    "Getafe","Alcorcón","Torrejón de Ardoz","Parla","Alcobendas",
    "Coslada","San Sebastián de los Reyes","Rivas-Vaciamadrid","Pozuelo de Alarcón",
    "Majadahonda","Las Rozas de Madrid","Valdemoro","Arganda del Rey",
    "Collado Villalba","Colmenar Viejo","Tres Cantos","San Lorenzo de El Escorial",
    "Galapagar","Villanueva de la Cañada","Villanueva del Pardillo",
    "Boadilla del Monte","Villaviciosa de Odón","Pinto","Griñón",
    "Torrelodones","Moralzarzal","Hoyo de Manzanares","Navacerrada"
  ],
  "Málaga": [
    "Málaga","Marbella","Vélez-Málaga","Mijas","Fuengirola","Torremolinos",
    "Benalmádena","Estepona","Rincón de la Victoria","Antequera","Ronda",
    "Alhaurín de la Torre","Alhaurín el Grande","Nerja","Frigiliana",
    "Torrox","Villanueva del Rosario","Cómpeta","Manilva","Casares"
  ],
  "Murcia": [
    "Murcia","Cartagena","Lorca","Molina de Segura","Alcantarilla",
    "Mazarrón","Águilas","Torre-Pacheco","Cieza","Yecla","Jumilla",
    "San Javier","San Pedro del Pinatar","Las Torres de Cotillas",
    "Alhama de Murcia","Bullas","Cehegín","Caravaca de la Cruz"
  ],
  "Navarra": [
    "Pamplona","Tudela","Barañáin","Estella","Zizur Mayor","Burlada",
    "Villava","Ansoáin","Berriozar","Huarte","Ezcaray","Alsasua",
    "Elizondo","Aoiz","Tafalla","Olite","Sangüesa","Corella"
  ],
  "Ourense": [
    "Ourense","O Barco de Valdeorras","Verín","Xinzo de Limia","Allariz",
    "O Carballiño","A Rúa","Ribadavia","Celanova","Monterrei"
  ],
  "Palencia": [
    "Palencia","Aguilar de Campoo","Guardo","Villamuriel de Cerrato",
    "Venta de Baños","Saldaña","Carrión de los Condes"
  ],
  "Pontevedra": [
    "Vigo","Pontevedra","Vilagarcía de Arousa","Redondela","Cangas",
    "Marín","Lalín","O Porriño","Tui","Cambados","O Grove",
    "A Estrada","Caldas de Reis","Bueu","Sanxenxo"
  ],
  "Salamanca": [
    "Salamanca","Béjar","Ciudad Rodrigo","Peñaranda de Bracamonte",
    "Villares de la Reina","Santa Marta de Tormes","Guijuelo"
  ],
  "Segovia": [
    "Segovia","Cuéllar","San Ildefonso","El Espinar","Sepúlveda",
    "Carbonero el Mayor","Cantalejo"
  ],
  "Sevilla": [
    "Sevilla","Dos Hermanas","Alcalá de Guadaíra","Utrera","Mairena del Aljarafe",
    "Écija","La Rinconada","Carmona","Osuna","Los Palacios y Villafranca",
    "Coria del Río","Camas","Tomares","Mairena del Alcor","Bormujos",
    "Gelves","Santiponce","Espartinas","Villanueva del Ariscal",
    "Lebrija","Morón de la Frontera","Arahal","Estepa"
  ],
  "Soria": [
    "Soria","Ágreda","Almazán","Ólvega","San Esteban de Gormaz",
    "Burgo de Osma","Golmayo"
  ],
  "Tarragona": [
    "Tarragona","Reus","Salou","Cambrils","Vila-seca","Vendrell",
    "Tortosa","Amposta","Calafell","Torredembarra","El Morell",
    "Valls","Montblanc","Gandesa","Ampolla"
  ],
  "Teruel": [
    "Teruel","Alcañiz","Andorra","Calamocha","Monreal del Campo",
    "Cella","Valderrobres","Albarracín"
  ],
  "Toledo": [
    "Toledo","Talavera de la Reina","Illescas","Seseña","Torrijos",
    "Consuegra","Madridejos","Ocaña","Quintanar de la Orden",
    "Orgaz","La Puebla de Montalbán","Sonseca","Navahermosa"
  ],
  "Valencia": [
    "Valencia","Gandía","Torrent","Paterna","Sagunto","Alzira",
    "Mislata","Xàtiva","Ontinyent","Alaquàs","Aldaia","Manises",
    "Burjassot","Xirivella","Catarroja","Silla","Albal","Picanya",
    "Sedaví","Benetússer","Sueca","Cullera","Oliva","Daimús",
    "Bellreguard","Gandía","Tabernes de Valldigna","Carcaixent",
    "Algemesí","Carlet","Benifaió","Alginet","Llombai","Massalavés"
  ],
  "Valladolid": [
    "Valladolid","Laguna de Duero","Medina del Campo","Arroyo de la Encomienda",
    "Tordesillas","Íscar","Peñafiel","Simancas","Zaratán"
  ],
  "Vizcaya": [
    "Bilbao","Barakaldo","Getxo","Portugalete","Santurtzi","Basauri",
    "Leioa","Galdakao","Sestao","Durango","Amorebieta-Etxano",
    "Erandio","Bermeo","Mungia","Guernika","Ondarroa","Berriatua"
  ],
  "Zamora": [
    "Zamora","Benavente","Toro","Puebla de Sanabria","Villalpando",
    "Fermoselle","Morales del Vino"
  ],
  "Zaragoza": [
    "Zaragoza","Calatayud","Utebo","Cuarte de Huerva","Zuera",
    "Ejea de los Caballeros","Tarazona","La Almunia de Doña Godina",
    "Caspe","Tauste","Magallón","Illueca","Daroca"
  ],
};
