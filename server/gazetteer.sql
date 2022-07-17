create table gazetteer
(
    id           int unsigned auto_increment
        primary key,
    key_name     varchar(40) charset ascii default ''                not null,
    name         varchar(80)                                         not null,
    admin2       varchar(6)                                          not null,
    admin1       varchar(6)                                          not null,
    country      char(3)                                             null,
    latitude     float                     default 0                 not null,
    longitude    float                     default 0                 not null,
    elevation    smallint                  default 0                 not null,
    population   int(10)                                             not null,
    timezone     varchar(40) charset ascii default '0'               not null,
    tzu          tinyint(1)                default 0                 not null,
    `rank`       tinyint                   default 0                 not null,
    feature_code char(8) charset ascii                               not null,
    mphone1      varchar(16) charset ascii                           null,
    mphone2      varchar(16) charset ascii                           null,
    source       varchar(8)                default '0'               not null,
    geonames_id  int unsigned              default 0                 not null,
    edited       tinyint                   default 0                 not null,
    time_stamp   timestamp                 default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP,
    constraint name
        unique (name, admin2, admin1, country, feature_code)
)
    engine = MyISAM;

create index country
    on gazetteer (country);

create index edited
    on gazetteer (edited);

create fulltext index fname
    on gazetteer (name);

create index geonames_id
    on gazetteer (geonames_id);

create index key_name
    on gazetteer (key_name);

create index latitude
    on gazetteer (latitude);

create index longitude
    on gazetteer (longitude);

create index mphone1
    on gazetteer (mphone1);

create index mphone2
    on gazetteer (mphone2);

create index source
    on gazetteer (source);

create table gazetteer_admin1
(
    id          int unsigned,
    name        varchar(80)                         not null,
    key_name    varchar(20)                         not null
        primary key,
    code        varchar(6)                          not null,
    geonames_id int(10)                             not null,
    source      varchar(4)                          not null,
    time_stamp  timestamp default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP
);

create index code2
    on gazetteer_admin1 (code);

create index id
    on gazetteer_admin1 (id);

alter table gazetteer_admin1
    modify id int unsigned auto_increment;

create table gazetteer_admin2
(
    id          int unsigned,
    name        varchar(80)                         not null,
    key_name    varchar(20)                         not null
        primary key,
    code        varchar(6)                          not null,
    geonames_id int(10)                             not null,
    source      varchar(4)                          not null,
    time_stamp  timestamp default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP
);

create index code2
    on gazetteer_admin2 (code);

create index id
    on gazetteer_admin2 (id);

alter table gazetteer_admin2
    modify id int unsigned auto_increment;

create table gazetteer_alt_names
(
    id               int unsigned,
    name             varchar(80)                         not null,
    lang             varchar(3)                          not null,
    key_name         varchar(40)                         not null,
    geonames_alt_id  int(10)                             not null,
    geonames_orig_id int(10)                             not null,
    gazetteer_id     int(10)                             not null,
    type             varchar(1)                          not null,
    source           varchar(4)                          not null,
    preferred        tinyint                             not null,
    short            tinyint                             not null,
    colloquial       tinyint                             not null,
    historic         tinyint                             not null,
    misspelling      tinyint(1)                          not null,
    time_stamp       timestamp default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP,
    primary key (gazetteer_id, type, lang, key_name, short, preferred, colloquial, misspelling, historic)
);

create index gazetteer_id
    on gazetteer_alt_names (gazetteer_id);

create index geonames_orig_id
    on gazetteer_alt_names (geonames_orig_id);

create index id
    on gazetteer_alt_names (id);

create index lang_key
    on gazetteer_alt_names (lang, key_name);

create index name
    on gazetteer_alt_names (name);

alter table gazetteer_alt_names
    modify id int unsigned auto_increment;

create table gazetteer_countries
(
    id           int unsigned,
    name         varchar(80)                         not null,
    iso2         varchar(2)                          not null,
    iso3         varchar(3)                          not null
        primary key,
    key_name     varchar(40)                         not null,
    geonames_id  int(10)                             not null,
    postal_regex varchar(255)                        not null,
    source       varchar(4)                          not null,
    time_stamp   timestamp default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP,
    constraint lang_key
        unique (key_name)
);

create index code2
    on gazetteer_countries (iso2);

create index id
    on gazetteer_countries (id);

alter table gazetteer_countries
    modify id int unsigned auto_increment;

create table gazetteer_legacy
(
    item_no      int unsigned auto_increment
        primary key,
    name         varchar(80) charset utf8              not null,
    admin2       varchar(80) charset utf8              not null,
    admin1       varchar(80) charset utf8              not null,
    country      char(3) charset ascii                 null,
    latitude     float                     default 0   not null,
    longitude    float                     default 0   not null,
    elevation    smallint                  default 0   not null,
    time_zone    varchar(40) charset ascii default '0' not null,
    `rank`       tinyint                   default 0   not null,
    feature_code char(8) charset ascii                 not null,
    source       tinyint                   default 0   not null
)
    engine = MyISAM
    collate = latin1_general_ci;

create index country
    on gazetteer_legacy (country);

create index latitude
    on gazetteer_legacy (latitude);

create index longitude
    on gazetteer_legacy (longitude);

create index source
    on gazetteer_legacy (source);

create table gazetteer_log
(
    time    timestamp default CURRENT_TIMESTAMP not null
        primary key,
    warning tinyint(1)                          not null,
    message text                                not null,
    lang    varchar(8)                          not null,
    ip      varchar(20)                         not null
);

create table gazetteer_postal
(
    id           int unsigned,
    country      varchar(2)                          not null,
    code         varchar(20)                         not null,
    name         varchar(80)                         not null,
    admin1       varchar(20)                         not null,
    latitude     float                               not null,
    longitude    float                               not null,
    accuracy     tinyint                             not null,
    timezone     varchar(40)                         not null,
    geonames_id  int(10)                             not null,
    gazetteer_id int(10)                             not null,
    source       varchar(4)                          not null,
    time_stamp   timestamp default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP,
    primary key (country, code, admin1)
);

create index code
    on gazetteer_postal (code);

create index gazetteer_id
    on gazetteer_postal (gazetteer_id);

create index geonames_id
    on gazetteer_postal (geonames_id);

create index id
    on gazetteer_postal (id);

alter table gazetteer_postal
    modify id int unsigned auto_increment;

create table gazetteer_searches
(
    search_string varchar(80) collate utf16_unicode_ci default ''                not null
        primary key,
    extended      tinyint                                                        not null,
    hits          int                                  default 0                 not null,
    matches       smallint                             default 0                 not null,
    lang          varchar(8)                                                     not null,
    ip            varchar(20)                                                    not null,
    time_stamp    timestamp                            default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP
)
    engine = MyISAM
    collate = latin1_general_ci;

create table gazetteer_timezones
(
    location varchar(255) not null
        primary key,
    zones    text         not null
);
