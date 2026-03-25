
import fs from 'fs';
import path from 'path';

async function testRelease() {
  const githubToken = process.env.GITHUB_TOKEN;
  const githubRepo = process.env.GITHUB_REPO || "WilliamMajanja/Minima-PiNet-Os";
  const artifactPath = path.join(process.cwd(), "PiNetOS-RaspberryPi.img");

  console.log("GITHUB_TOKEN exists:", !!githubToken);
  console.log("GITHUB_REPO:", githubRepo);
  console.log("Artifact exists:", fs.existsSync(artifactPath));

  if (!githubToken) {
    console.error("GITHUB_TOKEN is missing");
    return;
  }

  try {
    const releaseResponse = await fetch(`https://api.github.com/repos/${githubRepo}/releases`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tag_name: `v2.0.0-test-${Date.now()}`,
        name: `Test Release - ${new Date().toLocaleDateString()}`,
        body: "Test release from script.",
        draft: false,
        prerelease: false
      })
    });

    const releaseData = await releaseResponse.json();
    console.log("Release Response:", JSON.stringify(releaseData, null, 2));

    if (releaseResponse.ok) {
      const uploadUrl = releaseData.upload_url.replace('{?name,label}', '?name=Test-Artifact.img');
      const fileBuffer = fs.readFileSync(artifactPath);
      
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `token ${githubToken}`,
          'Content-Type': 'application/octet-stream',
          'Content-Length': fileBuffer.length.toString()
        },
        body: fileBuffer
      });

      const uploadData = await uploadResponse.json();
      console.log("Upload Response:", JSON.stringify(uploadData, null, 2));
    }
  } catch (error) {
    console.error("Error:", error);
  }
}

testRelease();
