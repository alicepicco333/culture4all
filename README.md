# culture4all
This is the repository for the final project of the course Information Visualization at University of Bologna. Digital Humanities and Digital Knowledge MA 2023/2024.



<h2><b>2026 redesign</b></h2>

The site is a data story built with D3 (`index.html`, `js/story.js`, `assets/css/story.css`). Every figure comes from
`data/story/*.json`, which `scripts/build_story_data.py` rebuilds from the source files in this repository:

    python scripts/build_story_data.py

What the story covers: libraries per inhabitant, municipalities without a library and the distance to the nearest one,
library loans, reading habits and how they changed from 2011 to 2021, free museum entry, and events published in the
Ministry of Culture's open data. Readers can **follow a region** through every chart, see where it stands on each
measure, link to it (`?region=Campania`) and save that summary as an image.

Added data: ISTAT resident population by municipality on 1 January 2023 (`data/population/comuni_2023.csv`, from the
POSAS release), used for residents without a library and events per resident.

Testing how readers understand the charts: [docs/usability-test.md](docs/usability-test.md).

<h2><b>Credits</b></h2>

<b>Corrado Consiglio</b> - Data Gathering - Data Curation - Data investigation

<b>Salvatore Di Marzo</b> - Data Gathering - Data Curation - Data Investigation

<b>Alice Picco</b> - Data Gathering - Data Visualization - Web page development

<h2><b>License</b></h2>
<p>The data gathered from <a href="https://dati.cultura.gov.it/descrizione_dataset/">dati.cultura</a> and the ones gathered from the <a href="https://www.istat.it/it/note-legali">ISTAT</a>
  are licensed under CC-BY 4.0</p>

<p xmlns:cc="http://creativecommons.org/ns#" xmlns:dct="http://purl.org/dc/terms/"><a property="dct:title" rel="cc:attributionURL" href="https://github.com/alicepicco333/culture4all">culture4all</a> by <span property="cc:attributionName">Alice Picco - Salvatore Di Marzo - Corrado Consiglio</span> is marked with <a href="https://creativecommons.org/publicdomain/zero/1.0/?ref=chooser-v1" target="_blank" rel="license noopener noreferrer" style="display:inline-block;">CC0 1.0<img style="height:22px!important;margin-left:3px;vertical-align:text-bottom;" src="https://mirrors.creativecommons.org/presskit/icons/cc.svg?ref=chooser-v1" alt=""><img style="height:22px!important;margin-left:3px;vertical-align:text-bottom;" src="https://mirrors.creativecommons.org/presskit/icons/zero.svg?ref=chooser-v1" alt=""></a></p>
