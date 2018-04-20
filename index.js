main();

function main() {
    hookMicrophoneProcessor(processSample, 512, 1, 1)
}


function hookMicrophoneProcessor(processSampleCallback, sampleRate, inputChannels, outputChannels) {
    navigator.mediaDevices.getUserMedia({audio: true, video: false})
        .then((stream) => {
            let context = new AudioContext();
            let input = context.createMediaStreamSource(stream);
            let processor = context.createScriptProcessor(sampleRate, inputChannels, outputChannels);

            input.connect(processor);
            processor.connect(context.destination);

            console.log("BufferSize: ", processor.bufferSize);
            console.log("Channel Count: ", processor.channelCount);
            console.log("Input Channels: ", processor.numberOfInputs);
            console.log("Output Channels: ", processor.numberOfOutputs);

            processor.onaudioprocess = function (e) {
                let inputBuffer = e.inputBuffer;
                let outputBuffer = e.outputBuffer;

                // Loop through the output channels (in this case there is only one)
                for (let channel = 0; channel < outputBuffer.numberOfChannels; channel++) {
                    let inputData = inputBuffer.getChannelData(channel);
                    let outputData = outputBuffer.getChannelData(channel);

                    // Loop through the samples
                    for (let sample = 0; sample < inputBuffer.length; sample++) {
                        // make output equal to the same as the input
                        outputData[sample] = processSampleCallback(inputData[sample], channel);
                    }
                }
            };
        });
}


let maxSignalLength = 5000;

let pitches = [];
let samplesProcessed = 1;
let startTime = Date.now();
let harmony = pitches.map((pitchDiff) => {
    return {
        pitchDelta: Math.pow(2, pitchDiff / 12.0),
        signal: [],
        pitchSum: 0.0
    }
});

function processSample(sample, channel) {
    samplesProcessed += 1;
    if (samplesProcessed % (maxSignalLength * 100) === 0) {
        console.log(`${100} windows (${maxSignalLength * 100} samples) processed in ${(Date.now() - startTime) / 1000.0} seconds`);
        startTime = Date.now();
    }
    let output = 0;

    for (let pitch of harmony) {
        pitch.signal.push(sample);

        if (pitch.pitchSum >= 1) {
            pitch.pitchSum -= 1;
            output += pitch.signal.shift();
        }
        else {
            output += pitch.signal[0];
        }

        if (pitch.signal.length >= maxSignalLength) {
            pitch.signal = [];
        }
        pitch.pitchSum += pitch.pitchDelta;
    }

    return output;
}


let pressedNotes = [];
WebMidi.enable(function (err) {

    if (err) {
        console.log("WebMidi could not be enabled.", err);
    }

    // Viewing available inputs and outputs
    console.log("Midi inputs: ", WebMidi.inputs);

    // Retrieve an input by name, id or index
    let input = WebMidi.inputs[0];

    // Listen for a 'note on' message on all channels
    input.addListener('noteon', "all",
        function (e) {
            console.log(`Received 'noteon' message: ${e.note.number} (${e.note.name}  ${e.note.octave}).`);
            let number = e.note.number;
            if (pressedNotes.indexOf(number) === -1) {
                pressedNotes.push(number);
                chordChanged();
            }
        }
    );

    input.addListener('noteoff', "all",
        function (e) {
            console.log(`Received 'noteoff' message: ${e.note.number} (${e.note.name}  ${e.note.octave}).`);
            let number = e.note.number;
            if (pressedNotes.indexOf(number) !== -1) {
                pressedNotes = pressedNotes.filter(val => val !== number);
                chordChanged();
            }
        }
    );
});


function chordChanged() {
    if (pressedNotes.length > 0) {
        let max = -999;
        for (let note of pressedNotes) {
            if (note > max) {
                max = note;
            }
        }

        pitches = [];
        for (let note of pressedNotes) {
            if (note !== max) {
                pitches.push(note - max);
            }
        }

        console.log("Harmony: ", pitches);
        harmony = pitches.map((pitchDiff) => {
            return {
                pitchDelta: Math.pow(2, pitchDiff / 12.0),
                signal: [],
                pitchSum: 0.0
            }
        });
    }
    else {
        pitches = [];
        harmony = [];
    }
}