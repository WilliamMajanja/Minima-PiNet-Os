# Flashing PiNetOS to an SD Card

Once you have the `PiNetOS-RaspberryPi.img` file, you can flash it to a MicroSD card to boot your Raspberry Pi.

## Using Raspberry Pi Imager (Recommended)

1. Download and install [Raspberry Pi Imager](https://www.raspberrypi.com/software/).
2. Open Raspberry Pi Imager.
3. Click **CHOOSE OS**.
4. Scroll down and select **Use custom**.
5. Select the `PiNetOS-RaspberryPi.img` file.
6. Click **CHOOSE STORAGE** and select your MicroSD card.
7. Click **WRITE**.
8. Once complete, insert the SD card into your Raspberry Pi and power it on.

## Using BalenaEtcher

1. Download and install [BalenaEtcher](https://balena.io/etcher/).
2. Open BalenaEtcher.
3. Click **Flash from file** and select `PiNetOS-RaspberryPi.img`.
4. Click **Select target** and choose your MicroSD card.
5. Click **Flash!**.
6. Once complete, insert the SD card into your Raspberry Pi and power it on.

## First Boot

On the first boot, PiNetOS will:
1. Display the custom Plymouth boot splash.
2. Start the X server and Openbox.
3. Automatically launch the PiNetOS web desktop (FastAPI + Jinja) in a Chromium kiosk window.
4. Start the Minima blockchain node in the background.
