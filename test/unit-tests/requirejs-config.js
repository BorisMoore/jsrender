// Configure loading modules from the download directory,
requirejs.config({
    "baseUrl": "//www.jsviews.com/download", // Or point to correct local path on your system: "baseUrl": "/download",
//    "baseUrl": "../../download", // Or point to correct local path on your system: "baseUrl": "/download",
    "paths": {
      "jquery": "//code.jquery.com/jquery-1.12.4",
      "jsrender": "./jsrender",
      "jquery.observable": "./jquery.observable",
      "jquery.views": "./jquery.views",
      "jsviews": "./jsviews"
    }
});
