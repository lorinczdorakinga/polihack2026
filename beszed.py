import subprocess

def emergency_call(alert_type):
    with open("output.txt", "w", encoding="utf-8") as f:
        
        if emergency_type == "FIGHT_DETECTED" or emergency_type == "PANIC_DETECTED":
            f.write("Attention! Police have been notified and are on the way. Please remain calm, step back, and do not leave the area.")

        elif emergency_type == "FIRE_EVENT" or emergency_type == "SMOKE_EVENT":
            f.write("Fire emergency detected! Please evacuate the area immediately. Use the nearest safe exit. Move away from the danger zone.")

        elif emergency_type == "HEALTH_EMERGENCY":
            # Itt van az elsősegély nyújtási útmutató is
            f.write("Medical emergency detected. An ambulance has been dispatched. Please clear the area to give the person space. ")
            f.write("If the person is unresponsive, check their breathing. ")
            f.write("If they are NOT breathing, begin CPR immediately: push hard and fast in the center of the chest. ")
            f.write("If they ARE breathing, roll them gently onto their side into the recovery position. ")
            f.write("Stay with the patient until paramedics arrive.")

    try:
        # A bash paranccsal indítjuk a szkriptet
        subprocess.run(["bash", "music.sh"], check=True)
        print("A music.sh sikeresen lefutott.")
    except Exception as e:
        print(f"Hiba történt a music.sh indításakor: {e}")