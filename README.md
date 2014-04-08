# Leaflet

This is a Patternslib plugin for [Leaflet](http://leafletjs.com/).

If you want to use this pattern stand-alone you will need to build a minibundle with ..... You will need to have [nodejs](http://nodejs.org)installed. If you not yet have bower and requirejs installed into your computer with npm just install these globally with npm (use sudo and enter your password if you not have the right credentials to install directly):

```
sudo npm install -g bower requirejs
```

Go to the project directory and run bower to get all the depending vendor latest scripts defined in the bower.json file inside your project directory.
The hidden .bowerrc file sets the default directory to load the vendor files in a separate vendor folder
To build your project and compress all the files together you can run the included build.sh command

```
cd myprojectdirectory
bower install
app/build/build.sh

```

This will create a ``main.js`` file you can include in your HTML
files in addition to the standard Patterns bundle:

```html
<script type="text/javascript" charset="utf-8" src="patterns.js"></script>
<script type="text/javascript" charset="utf-8" src="main.js"></script>
```


