# get-vector-tile-info

Get vector tile total features count in different ways and detailed info on which tile is exceeding its size.

<h1>Installation</h1>
Clone this repository and run npm install

<h1>Usage</h1>
 Examining a vector tile to determine whether it complies with Mapbox's suggested maximum tile size of 500 KB and average tile size of 50 KB.

 Also user can get the total features per zoom level, layer-wise total features, the total no of features per tile, get the min and max size of tiles per zoom level.

<img width="302" alt="image" src="https://github.com/satya-auti/get-vector-tile-info/assets/103890980/ec35d6b3-684f-448a-8ea8-cbbbe3e9fea8">

<img width="235" alt="image" src="https://github.com/satya-auti/get-vector-tile-info/assets/103890980/37eaa8a0-6e22-4b76-a543-e50819623a6d">

<img width="536" alt="image" src="https://github.com/satya-auti/get-vector-tile-info/assets/103890980/0b504f2a-6152-43a6-9f05-489df52d68aa">


<h1>How to run</h1>

```
node src/total-features-per-tile.js
```
	 
```
node src/get-layer-feature-count-per-zoom.js
```

```
node src/get-tiles-min-max-size-zoom-wise.js
```
 
```
node src/get-layer-wise-total-feature-count.js
```
