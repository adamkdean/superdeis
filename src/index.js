var S = require('string'),
    fs = require('fs'),
    jf = require('jsonfile'),
    ini = require('ini'),
    sys = require('sys'),
    exec = require('child_process').exec,
    spawn = require('child_process').spawn,
    touch = require('touch'),
    util = require('util');

/* paths/constants */
var HOME_DIR = process.env.HOME,
    DEIS_SESSION = HOME_DIR + '/.deis/client.json',
    SUPERDEIS_CONFIG = HOME_DIR + '/.superdeis',
    SUPERDEIS_TOKENS = HOME_DIR + '/.superdeis_tokens';

var superdeis_config,
    superdeis_tokens,
    environment,
    command_args,
    argv = process.argv.slice(2);

/* check whether the superdeis config exists, load it if so */
if (fs.existsSync(SUPERDEIS_CONFIG)) {
    superdeis_config = ini.parse(fs.readFileSync(SUPERDEIS_CONFIG, 'utf8'));
} else {
    console.log('Error: no superdeis config');
    process.exit(1);
}

/* check if the tokens file exists, and create it or read it */
if (fs.existsSync(SUPERDEIS_TOKENS)) {
    superdeis_tokens = jf.readFileSync(SUPERDEIS_TOKENS, { throws: false }) || {};
} else {
    superdeis_tokens = {};
    touch(SUPERDEIS_TOKENS);
    saveSuperdeisTokens(superdeis_tokens);
}

/* check if an environment has been specified */
if (argv && argv.length > 0) {
    if (argv[0] in superdeis_config) {
        environment = argv[0];
    } else {
        console.log('Error: environment not configured');
        process.exit(1);
    }
} else {
    console.log('Error: no environment specified');
    process.exit(1);
}

/* get all other args to pass to deis */
if (argv.length > 1) {
    command_args = argv.slice(1);
} else {
    console.log('Error: no command specified');
    process.exit(1);
}

/* work out whether we are logged in, have a stored session, or have to login */
if (command_args[0] === 'login') {
    var controller = superdeis_config[environment].controller,
        username = superdeis_config[environment].username;

    console.log('Logging in as', username, 'to', controller);
    clearDeisSession();
    runCommand('deis', ['login', controller, '--username', username], function() {
        var new_session = loadDeisSession();
        if (new_session.username && new_session.controller && new_session.token) {
            superdeis_tokens[environment] = new_session;
            saveSuperdeisTokens(superdeis_tokens);
        } else {
            console.log('Error: unable to login');
            process.exit(1);
        }
    });
} else if (command_args[0] === 'logout') {
    runCommand('deis', ['logout'], function() {
        delete superdeis_tokens[environment];
        saveSuperdeisTokens(superdeis_tokens);
    });
} else if (environment in superdeis_tokens) {
    var deis_session = loadDeisSession(),
        stored_session = superdeis_tokens[environment],
        match_controller = stored_session.controller == deis_session.controller,
        match_username = stored_session.username == deis_session.username,
        match_token = stored_session.token == deis_session.token;

    /* we need to write our stored session to the deis session file */
    if (!match_controller || !match_username || !match_token) {
        fs.writeFileSync(DEIS_SESSION, JSON.stringify(stored_session));
        // console.log('Updated current session with stored session.')
    }

    /* now run the command */
    runCommand('deis', command_args, function() {
        // console.log('superdeis done');
    });
} else {
    console.log('Please login using superdeis.');
    console.log('Usage: superdeis <environment> login');
    process.exit(1);
}

function saveSuperdeisTokens(tokens) {
    fs.writeFileSync(SUPERDEIS_TOKENS, JSON.stringify(tokens));
}

function loadDeisSession() {
    return (fs.existsSync(DEIS_SESSION))
        ? jf.readFileSync(DEIS_SESSION, { throws: false }) || {}
        : {};
}

function clearDeisSession() {
    fs.writeFileSync(DEIS_SESSION, JSON.stringify({
        username: null,
        controller: null,
        token: null
    }));
}

function runCommand(command, args, callback) {
    var child = spawn(command, args, { stdio: [process.stdin, process.stdout, process.stderr]});
    child.on('exit', callback);
}
