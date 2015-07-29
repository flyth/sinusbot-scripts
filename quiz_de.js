registerPlugin({
    name: 'Quiz!',
    version: '1.0',
    description: 'Small triviabot that you can use to play with your friends on TeamSpeak.',
    author: 'Michael Friese <michael@sinusbot.com>',
    vars: {}
}, function(sinusbot, config) {
    var questions = [
        // q: question, a: answer (case insensitive), h: hints, alt: alternative answers (lowercase!)
        { q: 'Wie heißt die Hauptstadt von Deutschland?', a: 'Berlin', h: ['Sie ist gleichzeitig auch ein eigenes Bundesland.'] },
        { q: 'Wie nennt man das hölzerne Flugobjekt, das beim Werfen wieder zurückkommt?', a: 'Bumerang', alt: ['boomerang', 'bummerang'] },
        { q: 'Wie nennt man die Puppen, die an Schnüren bewegt werden?', a: 'Marionette', alt: ['marionetten'] }
    ];

    var language = 'de';
    var curQuestion = null;
    var step = -1;
    var hint = 0;
    var running = false;
    var nextStep = 0;

    var introUrl = 'res://quiz-intro.mp3';
    var outroUrl = 'res://quiz-end.mp3';
    var introLen = 30000;
    var questionIntroUrl = 'res://quiz-intro2.mp3/?ephemeral=true&callback=qintro';
    var questionIntroLen = 2400;
    var questionLoopUrl1 = 'res://quiz-bg1.mp3/?loop=true';
    var questionLoopUrl2 = 'res://quiz-bg2.mp3/?loop=true';
    var questionLoopUrl3 = 'res://quiz-bg3.mp3/?loop=true';
    var answerCorrect = 'res://quiz-correct1.mp3/?ephemeral=true&callback=correct';
    var answerWrong = 'res://quiz-wrong.mp3/?ephemeral=true&callback=wrong';

    var score = {};
    var names = {};
    var answered = true;

    var list = [];
    var qNo = 0;

    var nextQuestion = function() {
        log('Next Question!');
        qNo++;
        var n = list.pop();
        if (qNo > 12 || n === undefined) {
            log('We are done');
            step = -1;
            nextStep = 0;
            curQuestion = null;
            stop();
            play(outroUrl);
            var winner = '';
            var maxScore = 0;
            for (var id in score) {
                if (score[id] > maxScore) {
                    winner = names[id];
                    maxScore = score[id];
                }
            }
            if (winner != '') {
                // TODO: Tie!?
                log('Winner is ' + winner);
                say('Und der Gewinner heißt ' + winner + '. Herzlichen Glückwunsch und vielen Dank für\'s Mitspielen!', language);
            } else {
                say('Hier gibt es wohl dringend Nachholbedarf in Sachen Allgemeinwissen!', language);
            }
            running = false;
            return;
        }
        curQuestion = questions[n];
        answered = false;
        step = 0;
        hint = 0;
        nextStep = new Date().getTime() + questionIntroLen;
        if (questionIntroUrl) play(questionIntroUrl);
    };

    var run = function() {
        // Play intro
        log('Started new Game');
        running = true;
        step = 50;
        qNo = 0;
        score = {};
        list = getRandPerm(questions.length);
        nextStep = new Date().getTime() + 2000;
        if (introUrl) play(introUrl);
    };

    sinusbot.on('trackEnd', function(cb) {
        var stamp = new Date().getTime();
        switch (cb) {
            case 'question':
                step = 1;
                nextStep = stamp + 6000;
                break;
            case 'hint':
                nextStep = stamp + 6000;
                break;
            case 'wrong':
                answered = true;
                log('Die richtige Antwort lautet: ' + curQuestion.a);
                switch (qNo % 3) {
                    case 0:
                        say('Die richtige Antwort wäre gewesen: ' + curQuestion.a, language, 'correction');
                        break;
                    case 1:
                        say('Die Lösung war: ' + curQuestion.a, language, 'correction');
                        break;
                    case 2:
                        say('Richtig wäre: ' + curQuestion.a, language, 'correction');
                        break;
                }
                break;
            case 'correction':
            case 'congrat':
                step = 3;
                nextStep = stamp + 2000;
                break;
        }
    });

    sinusbot.on('timer', function(stamp) {
        if (!running) return;
        if (nextStep !== 0 && nextStep <= stamp) {
            switch (step) {
                case 0:
                    // Play question
                    nextStep = 0;
                    log(curQuestion.q);
                    say(curQuestion.q, language, 'question');
                    if (qNo > 9) {
                        if (questionLoopUrl3) play(questionLoopUrl3);
                    } else if (qNo > 5) {
                        if (questionLoopUrl2) play(questionLoopUrl2);
                    } else {
                        if (questionLoopUrl1) play(questionLoopUrl1);
                    }
                    break;
                case 1:
                    if (curQuestion.h && curQuestion.h.length > hint) {
                        log('Hint: ' + curQuestion.h[hint]);
                        say(curQuestion.h[hint], language, 'hint');
                        hint++;
                        nextStep = 0; // callback via trackend
                    } else {
                        step++;
                        nextStep = stamp + 3000;
                    }
                    break;
                case 2:
                    stop();
                    play(answerWrong);
                    nextStep = 0; // callback via trackend
                    break;
                case 3:
                    nextQuestion();
                    break;
                case 50:
                    say('Herzlich Willkommen bei wer kriegt "nix" im TeamSpeak! Augen gerade aus und Finger Weg von der Google-Suche!', language);
                    step = 51;
                    nextStep = stamp + introLen - 2000 - 2000;
                    break;
                case 51:
                    step = 52;
                    nextStep = stamp + 2000;
                    say('Los geht\'s!', language);
                    break;
                case 52:
                    nextQuestion();
                    break;
            }
        }
    });

    sinusbot.on('chat', function(ev) {
        if (ev.msg == '!quiz') {
            if (running) {
                chatPrivate(ev.clientId, 'Es läuft bereits eine Runde.');
                return;
            }
            run();
            return;
        }
        if (ev.msg == '!stopquiz') {
            step = -1;
            nextStep = 0;
            curQuestion = null;
            running = false;
            stop();
            return;
        }
        if (curQuestion != null && !answered) {
            var answer = ev.msg.trim().toLowerCase();
            log(ev.clientNick + ': ' + answer);
            if ((curQuestion.a.trim().toLowerCase() == answer) || (curQuestion.alt && curQuestion.alt.indexOf(answer) >= 0)) {
                nextStep = 0; // callback via trackend
                step = -1;
                answered = true;
                if (!score[ev.clientUid]) score[ev.clientUid] = 0;
                if (!names[ev.clientUid]) names[ev.clientUid] = ev.clientNick;
                score[ev.clientUid]++;
                stop();
                log(ev.clientNick + ' antwortete richtig.');
                play(answerCorrect);
                switch (qNo % 3) {
                    case 0:
                        say('Richtig, ' + ev.clientNick + '. Die Antwort war: ' + curQuestion.a, language, 'congrat');
                        break;
                    case 1:
                        say('Genau, ' + ev.clientNick + '. Die Lösung war: ' + curQuestion.a, language, 'congrat');
                        break;
                    case 2:
                        say('Weiter so, ' + ev.clientNick + '. Die Antwort war: ' + curQuestion.a, language, 'congrat');
                        break;
                }
                var str = '';
                for (var xi in score) {
                    str += '[b]' + names[xi] + '[/b] ' + score[xi] + ' ';
                }
                log('Stand: ' + str);
                chatChannel('Stand: ' + str);
            }
        }
    });
    run();
});
