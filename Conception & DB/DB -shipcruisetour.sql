-- phpMyAdmin SQL Dump
-- version 5.2.0
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Jan 28, 2023 at 12:32 PM
-- Server version: 10.4.27-MariaDB
-- PHP Version: 8.1.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

SET FOREIGN_KEY_CHECKS = 0;

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `shipcruisetour`
--

-- --------------------------------------------------------

--
-- Table structure for table `chambre`
--

CREATE TABLE `chambre` (
  `id` int(11) NOT NULL,
  `typeRom` int(11) DEFAULT NULL,
  `navire` int(11) DEFAULT NULL,
  `numberOfRom` int(11) DEFAULT NULL,
  `capacity` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `chambre`
--

INSERT INTO `chambre` (`id`, `typeRom`, `navire`, `numberOfRom`, `capacity`) VALUES
(1, 1, 1, 567, 1);

-- --------------------------------------------------------

--
-- Table structure for table `countries`
--

CREATE TABLE `countries` (
  `name` varchar(50) NOT NULL,
  `abv` char(2) NOT NULL DEFAULT '' COMMENT 'ISO 3661-1 alpha-2',
  `abv3` char(3) DEFAULT NULL COMMENT 'ISO 3661-1 alpha-3',
  `abv3_alt` char(3) DEFAULT NULL,
  `code` char(3) DEFAULT NULL COMMENT 'ISO 3661-1 numeric',
  `slug` varchar(50) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `countries`
--

INSERT INTO `countries` (`name`, `abv`, `abv3`, `abv3_alt`, `code`, `slug`) VALUES
('Andorra', 'AD', 'AND', NULL, '20', 'andorra'),
('United Arab Emirates', 'AE', 'ARE', NULL, '784', 'united-arab-emirates'),
('Afghanistan', 'AF', 'AFG', NULL, '4', 'afghanistan'),
('Antigua and Barbuda', 'AG', 'ATG', NULL, '28', 'antigua-and-barbuda'),
('Anguilla', 'AI', 'AIA', NULL, '660', 'anguilla'),
('Albania', 'AL', 'ALB', NULL, '8', 'albania'),
('Armenia', 'AM', 'ARM', NULL, '51', 'armenia'),
('Netherlands Antilles', 'AN', 'ANT', NULL, '530', 'netherlands-antilles'),
('Angola', 'AO', 'AGO', NULL, '24', 'angola'),
('Argentina', 'AR', 'ARG', NULL, '32', 'argentina'),
('American Samoa', 'AS', 'ASM', NULL, '16', 'american-samoa'),
('Austria', 'AT', 'AUT', NULL, '40', 'austria'),
('Australia', 'AU', 'AUS', NULL, '36', 'australia'),
('Aruba', 'AW', 'ABW', NULL, '533', 'aruba'),
('Aland Islands', 'AX', 'ALA', NULL, '248', 'aland-islands'),
('Azerbaijan', 'AZ', 'AZE', NULL, '31', 'azerbaijan'),
('Bosnia and Herzegovina', 'BA', 'BIH', NULL, '70', 'bosnia-and-herzegovina'),
('Barbados', 'BB', 'BRB', NULL, '52', 'barbados'),
('Bangladesh', 'BD', 'BGD', NULL, '50', 'bangladesh'),
('Belgium', 'BE', 'BEL', NULL, '56', 'belgium'),
('Burkina Faso', 'BF', 'BFA', NULL, '854', 'burkina-faso'),
('Bulgaria', 'BG', 'BGR', NULL, '100', 'bulgaria'),
('Bahrain', 'BH', 'BHR', NULL, '48', 'bahrain'),
('Burundi', 'BI', 'BDI', NULL, '108', 'burundi'),
('Benin', 'BJ', 'BEN', NULL, '204', 'benin'),
('Saint-Barthelemy', 'BL', 'BLM', NULL, '652', 'saint-barthelemy'),
('Bermuda', 'BM', 'BMU', NULL, '60', 'bermuda'),
('Brunei Darussalam', 'BN', 'BRN', NULL, '96', 'brunei-darussalam'),
('Bolivia', 'BO', 'BOL', NULL, '68', 'bolivia'),
('Brazil', 'BR', 'BRA', NULL, '76', 'brazil'),
('Bahamas', 'BS', 'BHS', NULL, '44', 'bahamas'),
('Bhutan', 'BT', 'BTN', NULL, '64', 'bhutan'),
('Botswana', 'BW', 'BWA', NULL, '72', 'botswana'),
('Belarus', 'BY', 'BLR', NULL, '112', 'belarus'),
('Belize', 'BZ', 'BLZ', NULL, '84', 'belize'),
('Canada', 'CA', 'CAN', NULL, '124', 'canada'),
('Democratic Republic of the Congo', 'CD', 'COD', NULL, '180', 'democratic-republic-of-congo'),
('Central African Republic', 'CF', 'CAF', NULL, '140', 'central-african-republic'),
('Congo', 'CG', 'COG', NULL, '178', 'congo'),
('Switzerland', 'CH', 'CHE', NULL, '756', 'switzerland'),
('Cote d\'Ivoire', 'CI', 'CIV', NULL, '384', 'cote-divoire'),
('Cook Islands', 'CK', 'COK', NULL, '184', 'cook-islands'),
('Chile', 'CL', 'CHL', 'CHI', '152', 'chile'),
('Cameroon', 'CM', 'CMR', NULL, '120', 'cameroon'),
('China', 'CN', 'CHN', NULL, '156', 'china'),
('Colombia', 'CO', 'COL', NULL, '170', 'colombia'),
('Costa Rica', 'CR', 'CRI', NULL, '188', 'costa-rica'),
('Cuba', 'CU', 'CUB', NULL, '192', 'cuba'),
('Cape Verde', 'CV', 'CPV', NULL, '132', 'cape-verde'),
('Cyprus', 'CY', 'CYP', NULL, '196', 'cyprus'),
('Czech Republic', 'CZ', 'CZE', NULL, '203', 'czech-republic'),
('Germany', 'DE', 'DEU', NULL, '276', 'germany'),
('Djibouti', 'DJ', 'DJI', NULL, '262', 'djibouti'),
('Denmark', 'DK', 'DNK', NULL, '208', 'denmark'),
('Dominica', 'DM', 'DMA', NULL, '212', 'dominica'),
('Dominican Republic', 'DO', 'DOM', NULL, '214', 'dominican-republic'),
('Algeria', 'DZ', 'DZA', NULL, '12', 'algeria'),
('Ecuador', 'EC', 'ECU', NULL, '218', 'ecuador'),
('Estonia', 'EE', 'EST', NULL, '233', 'estonia'),
('Egypt', 'EG', 'EGY', NULL, '818', 'egypt'),
('Western Sahara', 'EH', 'ESH', NULL, '732', 'western-sahara'),
('Eritrea', 'ER', 'ERI', NULL, '232', 'eritrea'),
('Spain', 'ES', 'ESP', NULL, '724', 'spain'),
('Ethiopia', 'ET', 'ETH', NULL, '231', 'ethiopia'),
('Finland', 'FI', 'FIN', NULL, '246', 'finland'),
('Fiji', 'FJ', 'FJI', NULL, '242', 'fiji'),
('Falkland Islands', 'FK', 'FLK', NULL, '238', 'falkland-islands'),
('Micronesia', 'FM', 'FSM', NULL, '583', 'micronesia'),
('Faeroe Islands', 'FO', 'FRO', NULL, '234', 'faeroe-islands'),
('France', 'FR', 'FRA', NULL, '250', 'france'),
('Gabon', 'GA', 'GAB', NULL, '266', 'gabon'),
('Grenada', 'GD', 'GRD', NULL, '308', 'grenada'),
('Georgia', 'GE', 'GEO', NULL, '268', 'georgia'),
('French Guiana', 'GF', 'GUF', NULL, '254', 'french-guiana'),
('Guernsey', 'GG', 'GGY', NULL, '831', 'guernsey'),
('Ghana', 'GH', 'GHA', NULL, '288', 'ghana'),
('Gibraltar', 'GI', 'GIB', NULL, '292', 'gibraltar'),
('Greenland', 'GL', 'GRL', NULL, '304', 'greenland'),
('Gambia', 'GM', 'GMB', NULL, '270', 'gambia'),
('Guinea', 'GN', 'GIN', NULL, '324', 'guinea'),
('Guadeloupe', 'GP', 'GLP', NULL, '312', 'guadeloupe'),
('Equatorial Guinea', 'GQ', 'GNQ', NULL, '226', 'equatorial-guinea'),
('Greece', 'GR', 'GRC', NULL, '300', 'greece'),
('Guatemala', 'GT', 'GTM', NULL, '320', 'guatemala'),
('Guam', 'GU', 'GUM', NULL, '316', 'guam'),
('Guinea-Bissau', 'GW', 'GNB', NULL, '624', 'guinea-bissau'),
('Guyana', 'GY', 'GUY', NULL, '328', 'guyana'),
('Hong Kong', 'HK', 'HKG', NULL, '344', 'hong-kong'),
('Honduras', 'HN', 'HND', NULL, '340', 'honduras'),
('Croatia', 'HR', 'HRV', NULL, '191', 'croatia'),
('Haiti', 'HT', 'HTI', NULL, '332', 'haiti'),
('Hungary', 'HU', 'HUN', NULL, '348', 'hungary'),
('Indonesia', 'ID', 'IDN', NULL, '360', 'indonesia'),
('Ireland', 'IE', 'IRL', NULL, '372', 'ireland'),
('Israel', 'IL', 'ISR', NULL, '376', 'israel'),
('Isle of Man', 'IM', 'IMN', NULL, '833', 'isle-of-man'),
('India', 'IN', 'IND', NULL, '356', 'india'),
('Iraq', 'IQ', 'IRQ', NULL, '368', 'iraq'),
('Iran', 'IR', 'IRN', NULL, '364', 'iran'),
('Iceland', 'IS', 'ISL', NULL, '352', 'iceland'),
('Italy', 'IT', 'ITA', NULL, '380', 'italy'),
('Jersey', 'JE', 'JEY', NULL, '832', 'jersey'),
('Jamaica', 'JM', 'JAM', NULL, '388', 'jamaica'),
('Jordan', 'JO', 'JOR', NULL, '400', 'jordan'),
('Japan', 'JP', 'JPN', NULL, '392', 'japan'),
('Kenya', 'KE', 'KEN', NULL, '404', 'kenya'),
('Kyrgyzstan', 'KG', 'KGZ', NULL, '417', 'kyrgyzstan'),
('Cambodia', 'KH', 'KHM', NULL, '116', 'cambodia'),
('Kiribati', 'KI', 'KIR', NULL, '296', 'kiribati'),
('Comoros', 'KM', 'COM', NULL, '174', 'comoros'),
('Saint Kitts and Nevis', 'KN', 'KNA', NULL, '659', 'saint-kitts-and-nevis'),
('North Korea', 'KP', 'PRK', NULL, '408', 'north-korea'),
('South Korea', 'KR', 'KOR', NULL, '410', 'south-korea'),
('Kuwait', 'KW', 'KWT', NULL, '414', 'kuwait'),
('Cayman Islands', 'KY', 'CYM', NULL, '136', 'cayman-islands'),
('Kazakhstan', 'KZ', 'KAZ', NULL, '398', 'kazakhstan'),
('Laos', 'LA', 'LAO', NULL, '418', 'laos'),
('Lebanon', 'LB', 'LBN', NULL, '422', 'lebanon'),
('Saint Lucia', 'LC', 'LCA', NULL, '662', 'saint-lucia'),
('Liechtenstein', 'LI', 'LIE', NULL, '438', 'liechtenstein'),
('Sri Lanka', 'LK', 'LKA', NULL, '144', 'sri-lanka'),
('Liberia', 'LR', 'LBR', NULL, '430', 'liberia'),
('Lesotho', 'LS', 'LSO', NULL, '426', 'lesotho'),
('Lithuania', 'LT', 'LTU', NULL, '440', 'lithuania'),
('Luxembourg', 'LU', 'LUX', NULL, '442', 'luxembourg'),
('Latvia', 'LV', 'LVA', NULL, '428', 'latvia'),
('Libyan Arab Jamahiriya', 'LY', 'LBY', NULL, '434', 'libyan-arab-jamahiriya'),
('Morocco', 'MA', 'MAR', NULL, '504', 'morocco'),
('Monaco', 'MC', 'MCO', NULL, '492', 'monaco'),
('Moldova', 'MD', 'MDA', NULL, '498', 'moldova'),
('Montenegro', 'ME', 'MNE', NULL, '499', 'montenegro'),
('Saint-Martin', 'MF', 'MAF', NULL, '663', 'saint-martin'),
('Madagascar', 'MG', 'MDG', NULL, '450', 'madagascar'),
('Marshall Islands', 'MH', 'MHL', NULL, '584', 'marshall-islands'),
('Macedonia', 'MK', 'MKD', NULL, '807', 'macedonia'),
('Mali', 'ML', 'MLI', NULL, '466', 'mali'),
('Myanmar', 'MM', 'MMR', 'BUR', '104', 'myanmar'),
('Mongolia', 'MN', 'MNG', NULL, '496', 'mongolia'),
('Macao', 'MO', 'MAC', NULL, '446', 'macao'),
('Northern Mariana Islands', 'MP', 'MNP', NULL, '580', 'northern-mariana-islands'),
('Martinique', 'MQ', 'MTQ', NULL, '474', 'martinique'),
('Mauritania', 'MR', 'MRT', NULL, '478', 'mauritania'),
('Montserrat', 'MS', 'MSR', NULL, '500', 'montserrat'),
('Malta', 'MT', 'MLT', NULL, '470', 'malta'),
('Mauritius', 'MU', 'MUS', NULL, '480', 'mauritius'),
('Maldives', 'MV', 'MDV', NULL, '462', 'maldives'),
('Malawi', 'MW', 'MWI', NULL, '454', 'malawi'),
('Mexico', 'MX', 'MEX', NULL, '484', 'mexico'),
('Malaysia', 'MY', 'MYS', NULL, '458', 'malaysia'),
('Mozambique', 'MZ', 'MOZ', NULL, '508', 'mozambique'),
('Namibia', 'NA', 'NAM', NULL, '516', 'namibia'),
('New Caledonia', 'NC', 'NCL', NULL, '540', 'new-caledonia'),
('Niger', 'NE', 'NER', NULL, '562', 'niger'),
('Norfolk Island', 'NF', 'NFK', NULL, '574', 'norfolk-island'),
('Nigeria', 'NG', 'NGA', NULL, '566', 'nigeria'),
('Nicaragua', 'NI', 'NIC', NULL, '558', 'nicaragua'),
('Netherlands', 'NL', 'NLD', NULL, '528', 'netherlands'),
('Norway', 'NO', 'NOR', NULL, '578', 'norway'),
('Nepal', 'NP', 'NPL', NULL, '524', 'nepal'),
('Nauru', 'NR', 'NRU', NULL, '520', 'nauru'),
('Niue', 'NU', 'NIU', NULL, '570', 'niue'),
('New Zealand', 'NZ', 'NZL', NULL, '554', 'new-zealand'),
('Oman', 'OM', 'OMN', NULL, '512', 'oman'),
('Panama', 'PA', 'PAN', NULL, '591', 'panama'),
('Peru', 'PE', 'PER', NULL, '604', 'peru'),
('French Polynesia', 'PF', 'PYF', NULL, '258', 'french-polynesia'),
('Papua New Guinea', 'PG', 'PNG', NULL, '598', 'papua-new-guinea'),
('Philippines', 'PH', 'PHL', NULL, '608', 'philippines'),
('Pakistan', 'PK', 'PAK', NULL, '586', 'pakistan'),
('Poland', 'PL', 'POL', NULL, '616', 'poland'),
('Saint Pierre and Miquelon', 'PM', 'SPM', NULL, '666', 'saint-pierre-and-miquelon'),
('Pitcairn', 'PN', 'PCN', NULL, '612', 'pitcairn'),
('Puerto Rico', 'PR', 'PRI', NULL, '630', 'puerto-rico'),
('Palestine', 'PS', 'PSE', NULL, '275', 'palestine'),
('Portugal', 'PT', 'PRT', NULL, '620', 'portugal'),
('Palau', 'PW', 'PLW', NULL, '585', 'palau'),
('Paraguay', 'PY', 'PRY', NULL, '600', 'paraguay'),
('Qatar', 'QA', 'QAT', NULL, '634', 'qatar'),
('Reunion', 'RE', 'REU', NULL, '638', 'reunion'),
('Romania', 'RO', 'ROU', 'ROM', '642', 'romania'),
('Serbia', 'RS', 'SRB', NULL, '688', 'serbia'),
('Russian Federation', 'RU', 'RUS', NULL, '643', 'russian-federation'),
('Rwanda', 'RW', 'RWA', NULL, '646', 'rwanda'),
('Saudi Arabia', 'SA', 'SAU', NULL, '682', 'saudi-arabia'),
('Solomon Islands', 'SB', 'SLB', NULL, '90', 'solomon-islands'),
('Seychelles', 'SC', 'SYC', NULL, '690', 'seychelles'),
('Sudan', 'SD', 'SDN', NULL, '729', 'sudan'),
('Sweden', 'SE', 'SWE', NULL, '752', 'sweden'),
('Singapore', 'SG', 'SGP', NULL, '702', 'singapore'),
('Saint Helena', 'SH', 'SHN', NULL, '654', 'saint-helena'),
('Slovenia', 'SI', 'SVN', NULL, '705', 'slovenia'),
('Svalbard and Jan Mayen Islands', 'SJ', 'SJM', NULL, '744', 'svalbard-and-jan-mayen-islands'),
('Slovakia', 'SK', 'SVK', NULL, '703', 'slovakia'),
('Sierra Leone', 'SL', 'SLE', NULL, '694', 'sierra-leone'),
('San Marino', 'SM', 'SMR', NULL, '674', 'san-marino'),
('Senegal', 'SN', 'SEN', NULL, '686', 'senegal'),
('Somalia', 'SO', 'SOM', NULL, '706', 'somalia'),
('Suriname', 'SR', 'SUR', NULL, '740', 'suriname'),
('South Sudan', 'SS', 'SSD', NULL, '728', 'south-sudan'),
('Sao Tome and Principe', 'ST', 'STP', NULL, '678', 'sao-tome-and-principe'),
('El Salvador', 'SV', 'SLV', NULL, '222', 'el-salvador'),
('Syrian Arab Republic', 'SY', 'SYR', NULL, '760', 'syrian-arab-republic'),
('Swaziland', 'SZ', 'SWZ', NULL, '748', 'swaziland'),
('Turks and Caicos Islands', 'TC', 'TCA', NULL, '796', 'turks-and-caicos-islands'),
('Chad', 'TD', 'TCD', NULL, '148', 'chad'),
('Togo', 'TG', 'TGO', NULL, '768', 'togo'),
('Thailand', 'TH', 'THA', NULL, '764', 'thailand'),
('Tajikistan', 'TJ', 'TJK', NULL, '762', 'tajikistan'),
('Tokelau', 'TK', 'TKL', NULL, '772', 'tokelau'),
('Turkmenistan', 'TM', 'TKM', NULL, '795', 'turkmenistan'),
('Tunisia', 'TN', 'TUN', NULL, '788', 'tunisia'),
('Tonga', 'TO', 'TON', NULL, '776', 'tonga'),
('Timor-Leste', 'TP', 'TLS', NULL, '626', 'timor-leste'),
('Turkey', 'TR', 'TUR', NULL, '792', 'turkey'),
('Trinidad and Tobago', 'TT', 'TTO', NULL, '780', 'trinidad-and-tobago'),
('Tuvalu', 'TV', 'TUV', NULL, '798', 'tuvalu'),
('Tanzania', 'TZ', 'TZA', NULL, '834', 'tanzania'),
('Ukraine', 'UA', 'UKR', NULL, '804', 'ukraine'),
('Uganda', 'UG', 'UGA', NULL, '800', 'uganda'),
('United Kingdom', 'UK', 'GBR', NULL, '826', 'united-kingdom'),
('United States', 'US', 'USA', NULL, '840', 'united-states'),
('Uruguay', 'UY', 'URY', NULL, '858', 'uruguay'),
('Uzbekistan', 'UZ', 'UZB', NULL, '860', 'uzbekistan'),
('Holy See', 'VA', 'VAT', NULL, '336', 'holy-see'),
('Saint Vincent and the Grenadines', 'VC', 'VCT', NULL, '670', 'saint-vincent-and-grenadines'),
('Venezuela', 'VE', 'VEN', NULL, '862', 'venezuela'),
('British Virgin Islands', 'VG', 'VGB', NULL, '92', 'british-virgin-islands'),
('U.S. Virgin Islands', 'VI', 'VIR', NULL, '850', 'us-virgin-islands'),
('Viet Nam', 'VN', 'VNM', NULL, '704', 'viet-nam'),
('Vanuatu', 'VU', 'VUT', NULL, '548', 'vanuatu'),
('Wallis and Futuna Islands', 'WF', 'WLF', NULL, '876', 'wallis-and-futuna-islands'),
('Samoa', 'WS', 'WSM', NULL, '882', 'samoa'),
('Yemen', 'YE', 'YEM', NULL, '887', 'yemen'),
('Mayotte', 'YT', 'MYT', NULL, '175', 'mayotte'),
('South Africa', 'ZA', 'ZAF', NULL, '710', 'south-africa'),
('Zambia', 'ZM', 'ZMB', NULL, '894', 'zambia'),
('Zimbabwe', 'ZW', 'ZWE', NULL, '716', 'zimbabwe');

-- --------------------------------------------------------

--
-- Table structure for table `croisiére`
--

CREATE TABLE `croisiére` (
  `id` int(11) NOT NULL,
  `navire` int(11) DEFAULT NULL,
  `img` longblob DEFAULT NULL,
  `numberOfNight` int(11) DEFAULT NULL,
  `departmentPort` int(11) DEFAULT NULL,
  `DateOfDeparture` date DEFAULT NULL,
  `desc` varchar(255) NOT NULL,
  `TimeOfDeparture` time NOT NULL,
  `name` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `cruiseitinery`
--

CREATE TABLE `cruiseitinery` (
  `id` int(11) NOT NULL,
  `port` int(11) DEFAULT NULL,
  `croisiére` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `cruiseitinery`
--

INSERT INTO `cruiseitinery` (`id`, `port`, `croisiére`) VALUES
(1, 1, 1);

-- --------------------------------------------------------

--
-- Table structure for table `navire`
--

CREATE TABLE `navire` (
  `id` int(11) NOT NULL,
  `libelle` varchar(50) DEFAULT NULL,
  `numberOfRom` int(11) DEFAULT NULL,
  `numberOfPlaces` int(11) DEFAULT NULL,
  `img` longblob NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `port`
--

CREATE TABLE `port` (
  `id` int(11) NOT NULL,
  `name` varchar(50) DEFAULT NULL,
  `countrie` char(3) DEFAULT NULL,
  `img` longblob NOT NULL,
  `matricule` int(11) NOT NULL,
  `city` varchar(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `réservation`
--

CREATE TABLE `réservation` (
  `id` int(11) NOT NULL,
  `user` int(11) DEFAULT NULL,
  `croisiére` int(11) DEFAULT NULL,
  `chambre` int(11) DEFAULT NULL,
  `price` float DEFAULT NULL,
  `date` date NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `réservation`
--

INSERT INTO `réservation` (`id`, `user`, `croisiére`, `chambre`, `price`, `date`) VALUES
(3, 11, 1, 1, 321, '2023-01-28');

-- --------------------------------------------------------

--
-- Table structure for table `typerom`
--

CREATE TABLE `typerom` (
  `id` int(11) NOT NULL,
  `price` float DEFAULT NULL,
  `libelle` varchar(50) DEFAULT NULL,
  `min` int(11) DEFAULT NULL,
  `max` int(11) DEFAULT NULL,
  `img` longblob NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `typerom`
--
-- --------------------------------------------------------

--
-- Table structure for table `user`
--

CREATE TABLE `user` (
  `id` int(11) NOT NULL,
  `firstName` varchar(50) DEFAULT NULL,
  `lastName` varchar(50) DEFAULT NULL,
  `login` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `is_admin` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `user`
--

INSERT INTO `user` (`id`, `firstName`, `lastName`, `login`, `password`, `is_admin`) VALUES
(11, 'outman', 'ouharri', 'outman@gmail.com', '0a5b3913cbc9a9092311630e869b4442', 1);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `chambre`
--
ALTER TABLE `chambre`
  ADD PRIMARY KEY (`id`),
  ADD KEY `typeRom` (`typeRom`),
  ADD KEY `navire` (`navire`);

--
-- Indexes for table `countries`
--
ALTER TABLE `countries`
  ADD PRIMARY KEY (`abv`);

--
-- Indexes for table `croisiére`
--
ALTER TABLE `croisiére`
  ADD PRIMARY KEY (`id`),
  ADD KEY `navire` (`navire`),
  ADD KEY `departmentPort` (`departmentPort`);

--
-- Indexes for table `cruiseitinery`
--
ALTER TABLE `cruiseitinery`
  ADD PRIMARY KEY (`id`),
  ADD KEY `port` (`port`),
  ADD KEY `croisiére` (`croisiére`);

--
-- Indexes for table `navire`
--
ALTER TABLE `navire`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `port`
--
ALTER TABLE `port`
  ADD PRIMARY KEY (`id`),
  ADD KEY `countrie` (`countrie`);

--
-- Indexes for table `réservation`
--
ALTER TABLE `réservation`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user` (`user`),
  ADD KEY `croisiére` (`croisiére`),
  ADD KEY `chambre` (`chambre`);

--
-- Indexes for table `typerom`
--
ALTER TABLE `typerom`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `user`
--
ALTER TABLE `user`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `chambre`
--
ALTER TABLE `chambre`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `croisiére`
--
ALTER TABLE `croisiére`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `cruiseitinery`
--
ALTER TABLE `cruiseitinery`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `navire`
--
ALTER TABLE `navire`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `port`
--
ALTER TABLE `port`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `réservation`
--
ALTER TABLE `réservation`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `typerom`
--
ALTER TABLE `typerom`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `user`
--
ALTER TABLE `user`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=12;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `chambre`
--
ALTER TABLE `chambre`
  ADD CONSTRAINT `chambre_ibfk_1` FOREIGN KEY (`typeRom`) REFERENCES `typerom` (`id`),
  ADD CONSTRAINT `chambre_ibfk_2` FOREIGN KEY (`navire`) REFERENCES `navire` (`id`);

--
-- Constraints for table `croisiére`
--
ALTER TABLE `croisiére`
  ADD CONSTRAINT `croisiére_ibfk_1` FOREIGN KEY (`navire`) REFERENCES `navire` (`id`),
  ADD CONSTRAINT `croisiére_ibfk_2` FOREIGN KEY (`departmentPort`) REFERENCES `port` (`id`);

--
-- Constraints for table `cruiseitinery`
--
ALTER TABLE `cruiseitinery`
  ADD CONSTRAINT `cruiseitinery_ibfk_1` FOREIGN KEY (`port`) REFERENCES `port` (`id`),
  ADD CONSTRAINT `cruiseitinery_ibfk_2` FOREIGN KEY (`croisiére`) REFERENCES `croisiére` (`id`);

--
-- Constraints for table `port`
--
ALTER TABLE `port`
  ADD CONSTRAINT `port_ibfk_1` FOREIGN KEY (`countrie`) REFERENCES `countries` (`abv`);

--
-- Constraints for table `réservation`
--
ALTER TABLE `réservation`
  ADD CONSTRAINT `réservation_ibfk_1` FOREIGN KEY (`user`) REFERENCES `user` (`id`),
  ADD CONSTRAINT `réservation_ibfk_2` FOREIGN KEY (`croisiére`) REFERENCES `croisiére` (`id`),
  ADD CONSTRAINT `réservation_ibfk_3` FOREIGN KEY (`chambre`) REFERENCES `chambre` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
