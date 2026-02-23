package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const targetService = "http://localhost:8080"
const shigawireBackend = "http://host.docker.internal:8083"
const shigawireProxy = "http://host.docker.internal:9090"
const projectTestName = "proxy-test-project"

type Result struct {
	Name       string
	Method     string
	Endpoint   string
	StatusCode int
	Body       string
	Success    bool
}

type Project struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type Session struct {
	ID string `json:"id"`
}

func printResult(r Result) {
	fmt.Printf("\n%s %s %s\n", r.Method, r.Endpoint, r.Name)
	fmt.Printf("   Status: %d\n", r.StatusCode)
	fmt.Printf("   Body:   %s\n", r.Body)
}

func doRequest(name, method, url string, body io.Reader, headers map[string]string) Result {
	req, err := http.NewRequest(method, url, body)
	if err != nil {
		return Result{Name: name, Method: method, Endpoint: url, StatusCode: 0, Body: err.Error(), Success: false}
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return Result{Name: name, Method: method, Endpoint: url, StatusCode: 0, Body: err.Error(), Success: false}
	}
	defer resp.Body.Close()
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return Result{Name: name, Method: method, Endpoint: url, StatusCode: resp.StatusCode, Body: err.Error(), Success: false}
	}
	success := resp.StatusCode >= 200 && resp.StatusCode < 300
	return Result{Name: name, Method: method, Endpoint: url, StatusCode: resp.StatusCode, Body: string(respBody), Success: success}
}

func getProjectIDByName(resTargetGet Result, name string) (string, bool) {
	var projects []Project
	json.Unmarshal([]byte(resTargetGet.Body), &projects)

	var projectID string
	for _, p := range projects {
		if p.Name == name {
			projectID = p.ID
			break
		}
	}
	return projectID, projectID != ""
}

func getSessionID(resTargetGet Result) string {
	var session Session
	json.Unmarshal([]byte(resTargetGet.Body), &session)
	return session.ID
}

func responsesMatch(body1, body2 string, ignoreKeys []string) bool {
	var m1, m2 map[string]interface{}
	if err := json.Unmarshal([]byte(body1), &m1); err != nil {
		return false
	}
	if err := json.Unmarshal([]byte(body2), &m2); err != nil {
		return false
	}

	for _, key := range ignoreKeys {
		delete(m1, key)
		delete(m2, key)
	}

	b1, _ := json.Marshal(m1)
	b2, _ := json.Marshal(m2)
	return string(b1) == string(b2)
}

func main() {
	fmt.Println("Starting Verification Tests...")

	resTargetGet := doRequest("Get Health", "GET", targetService+"/api/v1/health", nil, nil)
	resTargetPostFail := doRequest("Upload File", "POST", targetService+"/api/v1/me/files/upload", nil, nil)
	ts := time.Now().Unix()
	accountBody, _ := json.Marshal(map[string]string{
		"username": fmt.Sprintf("littleguy%d", ts),
		"email":    fmt.Sprintf("littleguy%d@aperature.com", ts),
		"password": "secret123",
	})
	resTargetPost := doRequest("Create User", "POST", targetService+"/api/v1/users",
		bytes.NewReader(accountBody), map[string]string{"Content-Type": "application/json"})

	projects := doRequest("List Projects", "GET", shigawireBackend+"/api/v1/projects", nil, nil)
	projectID, found := getProjectIDByName(projects, projectTestName)
	if !found {
		projectBody, _ := json.Marshal(map[string]string{
			"name": projectTestName,
		})
		doRequest("Create Project", "POST", shigawireBackend+"/api/v1/projects", bytes.NewReader(projectBody), map[string]string{"Content-Type": "application/json"})
	}
	sessionBody, _ := json.Marshal(map[string]string{
		"name": "Proxy Test Session",
	})

	session := doRequest("Create Session", "POST", shigawireBackend+"/api/v1/projects/"+projectID+"/sessions", bytes.NewReader(sessionBody), map[string]string{"Content-Type": "application/json"})
	resShigawireStart := doRequest("Proxy Start", "POST", shigawireBackend+"/api/v1/projects/"+projectID+"/sessions/"+getSessionID(session)+"/record/start", nil, nil)
	printResult(resShigawireStart)

	resShigawireProxyGet := doRequest("Get Health", "GET", shigawireProxy+"/api/v1/health", nil, nil)
	resShigawireProxyPostFail := doRequest("Upload File", "POST", shigawireProxy+"/api/v1/me/files/upload", nil, nil)
	// refreshing since db needs unique vals
	accountBody, _ = json.Marshal(map[string]string{
		"username": fmt.Sprintf("littleguys%d", ts),
		"email":    fmt.Sprintf("littleguys%d@aperature.com", ts),
		"password": "secret123",
	})
	// needs to wait until quietstore allows script to make a second request, otherwise responses won't match
	time.Sleep(10 * time.Second)
	resShigawireProxyPost := doRequest("Create User", "POST", shigawireProxy+"/api/v1/users",
		bytes.NewReader(accountBody), map[string]string{"Content-Type": "application/json"})

	// need to wait again
	resShigawireProxyGetUsers := doRequest("List Users", "GET", shigawireProxy+"/api/v1/users", nil, nil)
	resTargetGetUsers := doRequest("List Users", "GET", targetService+"/api/v1/users", nil, nil)

	// comparison tests
	getTestResult := responsesMatch(resShigawireProxyGet.Body, resTargetGet.Body, []string{"created_at", "updated_at", "timestamp"})
	if getTestResult {
		fmt.Println("\n✅ Proxy GET response matches target service GET response")
	} else {
		fmt.Println("\n❌ Proxy GET response does not match target service GET response")
	}

	if resShigawireProxyPostFail.StatusCode == resTargetPostFail.StatusCode {
		fmt.Println("\n✅ Proxy POST failure response matches target service POST failure response")
	} else {
		fmt.Println("\n❌ Proxy POST failure response does not match target service POST failure response")
		fmt.Println("\t\n-> Target POST Response:", resTargetPostFail.Body)
		fmt.Println("\t\n-> Proxy POST Response:", resShigawireProxyPostFail.Body)
	}

	if resShigawireProxyPost.StatusCode == resTargetPost.StatusCode {
		fmt.Println("\n✅ Proxy POST response matches target service POST response")
	} else {
		fmt.Println("\n❌ Proxy POST response does not match target service POST response")
		fmt.Println("\t\n-> Target POST Response:", resTargetPost.Body)
		fmt.Println("\t\n-> Proxy POST Response:", resShigawireProxyPost.Body)
	}

	getUsersTestResult := responsesMatch(resShigawireProxyGetUsers.Body, resTargetGetUsers.Body, []string{"created_at", "updated_at", "timestamp"})
	if getUsersTestResult {
		fmt.Println("\n✅ Proxy GET /users response matches target service GET /users response")
	} else {
		fmt.Println("\n❌ Proxy GET /users response does not match target service GET /users response")
		fmt.Println("\t\n-> Target GET /users Response:", resTargetGetUsers.Body)
		fmt.Println("\t\n-> Proxy GET /users Response:", resShigawireProxyGetUsers.Body)
	}

	fmt.Println("\nVerification Tests Completed.")
}
