if [ ! -f in_progress ]; then
    touch in_progress
    cat output.txt
    espeak-ng -f output.txt -s 140 -p 80 -w test.wav
    ffmpeg -i test.wav -ar 8000 -ac 1 -f u8 -y output.raw
    python music.py
    rm in_progress
else
    echo "Audio is already playing. Skipping execution."
fi
