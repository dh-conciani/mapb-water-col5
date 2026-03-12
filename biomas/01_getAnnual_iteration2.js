//var asset = 'projects/nexgenmap/TRANSVERSAIS/AGUA5-FT-CERRADO-COL5';
//var asset =  'projects/nexgenmap/TRANSVERSAIS/AGUA5-FT'
var asset =  ee.ImageCollection('users/wwfrioparaguai/MapBiomasAGUA/iteration_2');

var bandNames = [
  "classification_1", 
  "classification_2", 
  "classification_3", 
  "classification_4", 
  "classification_5", 
  "classification_6", 
  "classification_7", 
  "classification_8", 
  "classification_9", 
  "classification_10", 
  "classification_11", 
  "classification_12"
];


var col_mensal = asset.map(function(i){
  var ano =  ee.Number.parse(ee.String(i.get('system:index')).slice(12));
  return i.set('year', ano).rename(bandNames);
});

print(col_mensal)

var cadence = 'annual';

var version = '11';

//var obs = 'new'
var obs = 'iteration2';

// set year
var years = ee.List.sequence(1985, 2020).getInfo();

// read territories
var territory = ee.Image('projects/mapbiomas-workspace/AUXILIAR/biomas-2019-raster')
 .rename('territory').aside(Map.addLayer);
  
// change the scale if you need.
var scale = 30;

// define a Google Drive output folder 
var driverFolder = 'mapb-water-col5-v' + version + 'd';

// Image area in hectares
var pixelArea = ee.Image.pixelArea().divide(10000);

var geometry = territory.geometry()

// convert a complex object to a simple feature collection 
var convert2table = function (obj) {
  obj = ee.Dictionary(obj);
    var territory = obj.get('territory');
    var classesAndAreas = ee.List(obj.get('groups'));
    
    var tableRows = classesAndAreas.map(
        function (classAndArea) {
            classAndArea = ee.Dictionary(classAndArea);
            var classId = classAndArea.get('class');
            var area = classAndArea.get('sum');
            var tableColumns = ee.Feature(null)
                .set('territory', territory)
                .set('class_id', classId)
                .set('area', area);
                
            return tableColumns;
        }
    );
  
    return ee.FeatureCollection(ee.List(tableRows));
};

// compute the area
var calculateArea = function (image, territory, geometry) {
    var territotiesData = pixelArea.addBands(territory).addBands(image)
        .reduceRegion({
            reducer: ee.Reducer.sum().group(1, 'class').group(1, 'territory'),
            geometry: geometry,
            scale: scale,
            maxPixels: 1e13
        });
        
    territotiesData = ee.List(territotiesData.get('groups'));
    var areas = territotiesData.map(convert2table);
    areas = ee.FeatureCollection(areas).flatten();
    return areas;
};

// perform per year 
var areas = years.map(
    function (year) {
        var image = col_mensal.filter(ee.Filter.eq('year', year)).mosaic()
        
        // get annual
        image = image.reduce('sum').gte(6).selfMask()
          
        var areas = calculateArea(image, territory, geometry);
        // set additional properties
        areas = areas.map(
            function (feature) {
                return feature.set('year', year)
                              .set('cadence', cadence)
                              .set('version', version)
                              .set('asset', asset)
                              .set('obs', obs);
            }
        );
        return areas;
    }
);
  
areas = ee.FeatureCollection(areas).flatten();

Export.table.toDrive({
        collection: areas,
        description: 'water-' + cadence + '-' + 'BIOMES' + '-' + obs + '-' + 'v' + version,
        folder: driverFolder,
        fileFormat: 'CSV'
    });

