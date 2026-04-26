import requests
import time
import threading

# Az IP címet az Arduino Serial Monitorról másold ki!
ESP_IP = "http://192.168.54.204" 

def zaj_figyelo():
    print("[INFO] Zajfigyelés elindult a háttérben...")
    while True:
        try:
            # Rövid timeout, hogy ne akadjon meg a program
            r = requests.get(f"{ESP_IP}/check_bumm", timeout=1)
            if r.text == "IGEN":
                print("\n [RIASZTAS] NAGY BUMM VOLT! \nSzog: ", end="", flush=True)
        except:
            pass # Ha épp foglalt az ESP (pl. mozog), most nem baj
        time.sleep(0.5) # Fél másodpercenként kérdezünk rá

# Elindítjuk a figyelőt egy külön szálon
t = threading.Thread(target=zaj_figyelo, daemon=True)
t.start()

def set_servo_angle(angle):
    url = f"{ESP_IP}/set"
    params = {'angle': angle}
    
    try:
        # A timeoutot érdemes 5 másodpercre állítani a biztonság kedvéért
        start_time = time.time()
        response = requests.get(url, params=params, timeout=5)
        end_time = time.time()
        
        if response.status_code == 200:
            print(f"Siker! ESP válasza: {response.text}")
            print(f"Válaszidő: {round(end_time - start_time, 3)} másodperc")
        else:
            print(f"Hiba: Az ESP {response.status_code} kódot küldött.")
            
    except requests.exceptions.Timeout:
        print("Hiba: Az ESP nem válaszolt időben (Timeout).")
    except requests.exceptions.RequestException as e:
        print(f"Hálózati hiba történt: {e}")
print("--- Wi-Fi Szervó és Bumm-detektor ---")
t = threading.Thread(target=zaj_figyelo, daemon=True)
t.start()

print("--- Wi-Fi Szervó és Bumm-detektor ---")
print("Írd be a szöget, vagy 'exit' a kilépéshez.")

# 2. Ez a fő ciklus, ami csak a te utasításaidat várja
try:
    while True:
        szog = input("Szög (0-180): ").strip()
        
        if szog.lower() == 'exit':
            break
        
        if szog.isdigit():
            fok = int(szog)
            if 0 <= fok <= 180:
                try:
                    # Elküldjük a szög parancsot
                    res = requests.get(f"{ESP_IP}/set", params={'angle': fok}, timeout=2)
                    print(f"ESP válasza: {res.text}")
                except Exception as e:
                    print(f"Hiba: Az ESP nem elérhető ({e})")
            else:
                print("0 és 180 közötti számot adj meg!")
        else:
            print("Kérlek számot írj be!")

except KeyboardInterrupt:
    print("\nLeállítás...")

print("Program vége.")