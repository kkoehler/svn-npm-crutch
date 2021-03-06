var fs = require("fs")
  , cp = require("child_process")
  , async = require ("async")
  , rimraf = require("rimraf")
  , rootDir = __dirname + "/../../.."
  , pkg = require(rootDir + "/package.json")
  , colors = require('colors')
  , deps = pkg.svnDependencies || {}
  , dep = ""
  , mkdirs
  , svnCheckout
  , svnUpdate
  , svnCleanup
  , npmInstall
  , cleanup
  , logok
  , logerr
  , errors = []
  , numDeps = Object.keys(deps).length;

logok = function(msg) {
  console.log('svn-crutch '.green + msg);
};

logerr = function(msg) {
  console.log('svn-crutch '.red + msg);
};

mkdirs = function(dep) {
  return function(callback) {
    async.waterfall([
        // Check if we already have a node_modules folder (we should)
        function(cb) {
          fs.exists(rootDir + "/node_modules", function(exists) {
            cb(null, exists);
          });
        },

        // Make the node_modules folder if we need to
        function(exists, cb) {
          if(!exists) {
            fs.mkdir(rootDir + "/node_modules", function(error) {
              cb(error);
            });
          } else {
            cb(null);
          }
        }

      ],

      // Final call back
      function(error) {
        callback(error);
      }
    );
  };
};

svnCheckout = function(dep) {
  return function(callback) {
    logok("Installing " + dep + " from svn...");
    var cmd = cp.spawn("svn", ["co", deps[dep], dep], {
      stdio: "inherit",
      cwd: rootDir + "/node_modules/"
    });

    cmd.on("exit", function(code, signal) {
      
      var errMsg = 0 !== code ? "svn checkout failed - i try to delete the dir for you - please run 'npm install' again and hope that it works now ;-)" : null;    
        
      if(code !== 0) {
          logerr("===============================================================================================");
          logerr("===============================================================================================");
          logerr("");
          logerr("i try to delete the dir for you - please run 'npm install' again and hope that it works now ;-)");
          logerr("");
          logerr("===============================================================================================");
          logerr("===============================================================================================");
          rimraf(rootDir + "/node_modules/" + dep, function(error) {
            callback(errMsg);
          });
      } 
      
      callback(errMsg);
    });
  };
};

svnUpdate = function(dep) {
  return function(callback) {
    logok("Making sure " + dep + " is up to date...");
    var cmd = cp.spawn("svn", ["update"], {
      stdio: "inherit",
      cwd: rootDir + "/node_modules/" + dep
    });

    cmd.on("exit", function(code) {
      var errMsg = 0 !== code ? "svn update failed" : null;
      callback(errMsg);
    });
  };
};

svnCleanup = function(dep) {
  return function(callback) {
    logok("Cleaning up svn repo " + dep + "...");
    var cmd = cp.spawn("svn", ["cleanup"], {
      stdio: "inherit",
      cwd: rootDir + "/node_modules/" + dep
    });

    cmd.on("exit", function(code) {
      var errMsg = 0 !== code ? "svn cleanup failed" : null;
      callback(errMsg);
    });
  };
};

npmInstall = function(dep) {
  return function(callback) {
    logok("Running `npm install` on " + dep + "...");

    var env = {}
      , eKeys = Object.keys(process.env)
      , cmd
      , i
      ;

    for(i = eKeys.length; i--;) {
      if(!/^npm_/i.test(eKeys[i])) {
        env[eKeys[i]] = process.env[eKeys[i]];
      }
    }

    // -----------------------------------------------------
    // Using `cp.spawn` here seems to be bad times
    // -----------------------------------------------------

    cp.exec("npm install", {
      stdio: "inherit",
      cwd: rootDir + "/node_modules/" + dep,
      env: env
    }, function(error) {
      callback(error ? "npm install failed" : null);
    });
  };
};

cleanup = function(dep) {
  return function(error) {
    if(error) {
      logerr("Failed to install " + dep);
      errors.push(dep + " (" + error + ")");
    } else {
      logok("Successfully installed " + dep);
    }

    if(0 === --numDeps) {
      if(errors.length) {
        logerr("");
        logerr("============================================");
        logerr("Encountered errors installing svn dependencies:");
        errors.forEach(function(err) {
          logerr(" * " + err);
        });
        logerr("============================================");
      } else {
        logok("");
        logok("============================================");
        logok("    Finished installing svn dependencies");
        logok("============================================");
      }
    }
  };
};

async.eachSeries(Object.keys(deps), function(dep, cb) {
  async.series([
    mkdirs(dep),
    svnCheckout(dep),
    svnCleanup(dep),
    svnUpdate(dep),
    svnCleanup(dep),
    npmInstall(dep)
  ], cb);
}, cleanup(dep));
