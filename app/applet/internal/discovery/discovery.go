package discovery

import (
	"context"
	"fmt"
	"log"

	"github.com/libp2p/go-libp2p"
	"github.com/libp2p/go-libp2p/core/host"
	"github.com/libp2p/go-libp2p/core/peer"
	"github.com/libp2p/go-libp2p/p2p/discovery/mdns"
)

type discoveryNotifee struct {
	PeerChan chan peer.AddrInfo
}

func (n *discoveryNotifee) HandlePeerFound(pi peer.AddrInfo) {
	n.PeerChan <- pi
}

func SetupDiscovery(ctx context.Context, port int) (host.Host, chan peer.AddrInfo, error) {
	h, err := libp2p.New(libp2p.ListenAddrStrings(fmt.Sprintf("/ip4/0.0.0.0/tcp/%d", port)))
	if err != nil {
		return nil, nil, err
	}

	peerChan := make(chan peer.AddrInfo)
	notifee := &discoveryNotifee{PeerChan: peerChan}

	ser := mdns.NewMdnsService(h, "pinetos-cluster", notifee)
	if err := ser.Start(); err != nil {
		return nil, nil, err
	}

	log.Printf("mDNS Discovery started. Node ID: %s\n", h.ID().String())
	return h, peerChan, nil
}
