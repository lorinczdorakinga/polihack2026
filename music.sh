espeak-ng "Warning! A person is dying currently, please run for your life! Ambulance is on the way" -s 140 -p 80 -w test.wav  && ffmpeg -i test.wav -ar 8000 -ac 1 -f u8 -y output.raw && python music.py

