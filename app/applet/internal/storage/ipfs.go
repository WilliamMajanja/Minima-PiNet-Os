package storage

import (
	"fmt"
	"os"

	shell "github.com/ipfs/go-ipfs-api"
)

func UploadFile(filepath string) {
	sh := shell.NewShell("localhost:5001")
	
	file, err := os.Open(filepath)
	if err != nil {
		fmt.Printf("Failed to open file: %v\n", err)
		return
	}
	defer file.Close()

	cid, err := sh.Add(file)
	if err != nil {
		fmt.Printf("Failed to upload to IPFS: %v\n", err)
		return
	}

	fmt.Printf("File uploaded successfully. CID: %s\n", cid)
}

func DownloadFile(cid string, outpath string) {
	sh := shell.NewShell("localhost:5001")
	err := sh.Get(cid, outpath)
	if err != nil {
		fmt.Printf("Failed to download from IPFS: %v\n", err)
		return
	}
	fmt.Printf("File downloaded to %s\n", outpath)
}
