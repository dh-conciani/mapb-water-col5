var asset = 'projects/nexgenmap/TRANSVERSAIS/AGUA5-FT-CERRADO-COL5';

var cadence = 'monthly';

// set year
var years = ee.List.sequence({'start': 1985, 'end': 2025, 'step': 1}).getInfo();

// set month
var months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

// read territories
var territory = ee.Image('projects/mapbiomas-workspace/AUXILIAR/biomas-2019-raster')
  .eq(4).selfMask().rename('territory');
  
// change the scale if you need.
var scale = 30;

// define a Google Drive output folder 
var driverFolder = 'mapb-water-col5-v11';

// Image area in hectares
var pixelArea = ee.Image.pixelArea().divide(10000);

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

// for each year
years.forEach(function(year) {
  
  
  months.forEach(function(month) {
    
    // read monthly 
    var monthly = ee.ImageCollection(asset)
                   .filter(ee.Filter.eq('version', '11'))
                   .filter(ee.Filter.eq('cadence', cadence))
                   .filter(ee.Filter.eq('year', year))
                   .mosaic()
                   .select('classification_' + month)
    
    // perform per year 
    var areas = [month].map(
        function (month) {
            var image = monthly;
            var areas = calculateArea(image, territory, geometry);
            // set additional properties
            areas = areas.map(
                function (feature) {
                    return feature.set('year', year)
                                  .set('month', month)
                                  .set('cadence', cadence);
                }
            );
            return areas;
        }
    );
    
    areas = ee.FeatureCollection(areas).flatten();
  
    Export.table.toDrive({
        collection: areas,
        description: 'water-' + cadence + '-' + 'CERRADO' + '-' + year + '-' + month,
        folder: driverFolder,
        fileFormat: 'CSV'
    });
        
  })
 
  
  
  
  
})



